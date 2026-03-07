import { db } from "../db/client";
import { orders, orderItems, sellers } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { convertOrderTotal, bpsOfToken } from "../utils/currency";
import { flowStateEmitter } from "../events/emitter";
import { OrderState, PAYOUT_DEFAULTS, GRACE_PERIOD_HOURS } from "../config/constants";
import { eq, and } from "drizzle-orm";
import type { IShippoBridge } from "../bridges/shippo.bridge";
import type { IPinataBridge } from "../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type {
  CreateOrderInput,
  SelectShippingInput,
  ConfirmEscrowInput,
  ConfirmLabelPrintedInput,
  ShippingRate,
  PayoutSchedule,
} from "../types/orders";
import type { Order, OrderItem } from "../db/schema";
import { PayoutService } from "./payout.service";

export class OrderService {
  constructor(
    private shippoBridge: IShippoBridge,
    private pinataBridge: IPinataBridge,
    private blockchainBridge: IBlockchainBridge,
    private payoutService: PayoutService
  ) {}

  async create(
    projectId: string,
    input: CreateOrderInput
  ): Promise<{
    orderId: string;
    shippingOptions: ShippingRate[];
    escrowAddress: string;
    subtotalUsd: number;
    totalUsd: number;
  }> {
    // Validate seller exists and belongs to project
    const [seller] = await db
      .select()
      .from(sellers)
      .where(and(eq(sellers.id, input.sellerId), eq(sellers.projectId, projectId), eq(sellers.isActive, true)))
      .limit(1);

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    // Calculate subtotal from items
    const subtotalUsd = input.items.reduce(
      (sum, item) => sum + item.unitPriceUsd * item.quantity,
      0
    );

    // Get shipping rates from Shippo
    const { shipmentId, rates } = await this.shippoBridge.getRates(
      input.addressFrom,
      input.addressTo,
      input.parcel
    );

    const orderId = generateId.order();

    // Insert order
    await db.insert(orders).values({
      id: orderId,
      projectId,
      sellerId: input.sellerId,
      buyerWallet: input.buyerWallet,
      sellerWallet: input.sellerWallet,
      state: "INITIATED",
      shippoShipmentId: shipmentId,
      addressFrom: input.addressFrom as any,
      addressTo: input.addressTo as any,
      parcel: input.parcel as any,
      subtotalUsd: subtotalUsd.toFixed(2),
      totalUsd: subtotalUsd.toFixed(2), // updated after shipping is selected
      platformFeeBps: seller.payoutConfig
        ? 250
        : 250,
    });

    // Insert order items
    if (input.items.length > 0) {
      await db.insert(orderItems).values(
        input.items.map((item) => ({
          id: `item_${generateId.order()}`,
          orderId,
          externalItemId: item.externalItemId,
          name: item.name,
          quantity: item.quantity,
          unitPriceUsd: item.unitPriceUsd.toFixed(2),
          weightOz: item.weightOz?.toFixed(2),
          dimensions: item.dimensions as any,
        }))
      );
    }

    return {
      orderId,
      shippingOptions: rates,
      escrowAddress: "0xEscrowContractAddress_stub",
      subtotalUsd,
      totalUsd: subtotalUsd,
    };
  }

  async selectShipping(
    orderId: string,
    projectId: string,
    input: SelectShippingInput
  ): Promise<{
    escrowAmountToken: string;
    exchangeRate: number;
    labelCid: string;
    totalUsd: number;
    shippingCostUsd: number;
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "INITIATED") {
      const err: any = new Error(
        `Cannot select shipping in state ${order.state}. Expected INITIATED.`
      );
      err.statusCode = 409;
      throw err;
    }

    // Purchase label from Shippo
    const label = await this.shippoBridge.purchaseLabel(input.rateId);

    // Pin label PDF to IPFS
    const labelCid = await this.pinataBridge.pinFile(
      label.labelUrl,
      `label_${orderId}`
    );

    const shippingCostUsd = parseFloat(label.shippingCostUsd);
    const totalUsd = parseFloat(order.subtotalUsd) + shippingCostUsd;
    const { escrowAmountToken, exchangeRate } = convertOrderTotal(totalUsd);

    await db
      .update(orders)
      .set({
        selectedRateId: input.rateId,
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
        labelUrl: label.labelUrl,
        labelIpfsCid: labelCid,
        shippingCostUsd: shippingCostUsd.toFixed(2),
        totalUsd: totalUsd.toFixed(2),
        escrowAmountToken,
        exchangeRate: exchangeRate.toFixed(8),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return { escrowAmountToken, exchangeRate, labelCid, totalUsd, shippingCostUsd };
  }

  async confirmEscrow(
    orderId: string,
    projectId: string,
    input: ConfirmEscrowInput
  ): Promise<{
    status: string;
    invoiceCid: string;
    payoutSchedule: PayoutSchedule;
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "INITIATED") {
      const err: any = new Error(
        `Cannot confirm escrow in state ${order.state}. Expected INITIATED.`
      );
      err.statusCode = 409;
      throw err;
    }

    if (!order.escrowAmountToken) {
      const err: any = new Error("Shipping must be selected before confirming escrow");
      err.statusCode = 400;
      throw err;
    }

    // Verify the escrow deposit on-chain
    const { verified, contractOrderId } = await this.blockchainBridge.verifyEscrowDeposit(
      input.txHash,
      order.escrowAmountToken,
      order.buyerWallet
    );

    if (!verified) {
      const err: any = new Error("Escrow deposit could not be verified");
      err.statusCode = 400;
      throw err;
    }

    // Pin invoice to IPFS
    const invoiceData = {
      orderId,
      buyerWallet: order.buyerWallet,
      sellerWallet: order.sellerWallet,
      totalUsd: order.totalUsd,
      escrowAmountToken: order.escrowAmountToken,
      escrowTxHash: input.txHash,
      timestamp: new Date().toISOString(),
    };
    const invoiceCid = await this.pinataBridge.pinJSON(invoiceData, `invoice_${orderId}`);

    // Optimistic state update: INITIATED → ESCROWED
    const [updated] = await db
      .update(orders)
      .set({
        state: "ESCROWED",
        escrowTxHash: input.txHash,
        escrowContractOrderId: contractOrderId,
        invoiceIpfsCid: invoiceCid,
        escrowedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.state, "INITIATED")))
      .returning();

    if (!updated) {
      const err: any = new Error("State transition conflict; please retry");
      err.statusCode = 409;
      throw err;
    }

    flowStateEmitter.emit("order:state_changed", {
      orderId,
      projectId,
      previousState: OrderState.INITIATED,
      newState: OrderState.ESCROWED,
      txHash: input.txHash,
      timestamp: new Date(),
    });

    const payoutSchedule: PayoutSchedule = {
      labelCreatedBps: PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
      shippedBps: PAYOUT_DEFAULTS.SHIPPED_BPS,
      deliveredBps: PAYOUT_DEFAULTS.DELIVERED_BPS,
      finalizedBps: PAYOUT_DEFAULTS.FINALIZED_BPS,
    };

    return { status: "ESCROWED", invoiceCid, payoutSchedule };
  }

  async confirmLabelPrinted(
    orderId: string,
    projectId: string,
    input: ConfirmLabelPrintedInput
  ): Promise<{
    status: string;
    payoutAmountToken: string;
    txHash: string;
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "ESCROWED") {
      const err: any = new Error(
        `Cannot confirm label printed in state ${order.state}. Expected ESCROWED.`
      );
      err.statusCode = 409;
      throw err;
    }

    if (input.sellerWallet !== order.sellerWallet) {
      const err: any = new Error("Wallet mismatch — not the order seller");
      err.statusCode = 403;
      throw err;
    }

    const escrowAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;

    // Pin receipt
    const receiptCid = await this.pinataBridge.pinJSON(
      { orderId, state: "LABEL_CREATED", timestamp: new Date().toISOString() },
      `receipt_label_${orderId}`
    );

    // Advance state on-chain
    const { txHash: advanceTx } = await this.blockchainBridge.advanceState(
      contractOrderId,
      "LABEL_CREATED",
      receiptCid
    );

    // Release 15% to seller
    const { txHash: releaseTx } = await this.blockchainBridge.releasePartial(
      contractOrderId,
      PAYOUT_DEFAULTS.LABEL_CREATED_BPS
    );

    const payoutAmountToken = bpsOfToken(escrowAmountToken, PAYOUT_DEFAULTS.LABEL_CREATED_BPS);

    // Record state transition
    const [updated] = await db
      .update(orders)
      .set({
        state: "LABEL_CREATED",
        labelCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.state, "ESCROWED")))
      .returning();

    if (!updated) {
      const err: any = new Error("State transition conflict; please retry");
      err.statusCode = 409;
      throw err;
    }

    // Record payout
    await this.payoutService.recordPayout({
      orderId,
      sellerId: order.sellerId,
      state: "LABEL_CREATED",
      escrowAmountToken,
      percentageBps: PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
      txHash: releaseTx,
      receiptIpfsCid: receiptCid,
    });

    flowStateEmitter.emit("order:state_changed", {
      orderId,
      projectId,
      previousState: OrderState.ESCROWED,
      newState: OrderState.LABEL_CREATED,
      txHash: advanceTx,
      timestamp: new Date(),
    });

    return { status: "LABEL_CREATED", payoutAmountToken, txHash: releaseTx };
  }

  async finalize(orderId: string, projectId: string): Promise<{
    status: string;
    finalPayoutToken: string;
    platformFeeToken: string;
    txHash: string;
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "DELIVERED") {
      const err: any = new Error(
        `Cannot finalize in state ${order.state}. Expected DELIVERED.`
      );
      err.statusCode = 409;
      throw err;
    }

    // Check grace period has passed
    if (order.graceEndsAt && order.graceEndsAt > new Date()) {
      const err: any = new Error(
        `Grace period has not expired yet. Expires at ${order.graceEndsAt.toISOString()}`
      );
      err.statusCode = 409;
      throw err;
    }

    const escrowAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;
    const platformFeeBps = order.platformFeeBps;

    const { txHash, sellerAmount, feeAmount } = await this.blockchainBridge.releaseFinal(
      contractOrderId,
      platformFeeBps
    );

    const [updated] = await db
      .update(orders)
      .set({
        state: "FINALIZED",
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.state, "DELIVERED")))
      .returning();

    if (!updated) {
      const err: any = new Error("State transition conflict; please retry");
      err.statusCode = 409;
      throw err;
    }

    await this.payoutService.recordPayout({
      orderId,
      sellerId: order.sellerId,
      state: "FINALIZED",
      escrowAmountToken,
      percentageBps: PAYOUT_DEFAULTS.FINALIZED_BPS,
      txHash,
      platformFeeToken: feeAmount,
    });

    flowStateEmitter.emit("order:state_changed", {
      orderId,
      projectId,
      previousState: OrderState.DELIVERED,
      newState: OrderState.FINALIZED,
      txHash,
      timestamp: new Date(),
    });

    return {
      status: "FINALIZED",
      finalPayoutToken: sellerAmount,
      platformFeeToken: feeAmount,
      txHash,
    };
  }

  async getById(orderId: string, projectId: string): Promise<{
    order: Order;
    items: OrderItem[];
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    return { order, items };
  }
}
