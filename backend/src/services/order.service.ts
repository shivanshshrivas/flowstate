import { db } from "../db/client";
import type { Order, OrderItem, Seller } from "../db/types";
import { toDate } from "../db/utils";
import { generateId } from "../utils/id-generator";
import { convertOrderTotal, bpsOfToken } from "../utils/currency";
import { flowStateEmitter } from "../events/emitter";
import { OrderState, PAYOUT_DEFAULTS } from "../config/constants";
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
import { PayoutService } from "./payout.service";

export class OrderService {
  constructor(
    private shippoBridge: IShippoBridge,
    private pinataBridge: IPinataBridge,
    private blockchainBridge: IBlockchainBridge,
    private payoutService: PayoutService,
  ) {}

  async create(
    projectId: string,
    input: CreateOrderInput,
  ): Promise<{
    orderId: string;
    shippingOptions: ShippingRate[];
    escrowAddress: string;
    subtotalUsd: number;
    totalUsd: number;
  }> {
    const sellerRows = await db<Seller[]>`
      select *
      from sellers
      where id = ${input.sellerId}
        and project_id = ${projectId}
        and is_active = true
      limit 1
    `;

    const seller = sellerRows[0];

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const subtotalUsd = input.items.reduce(
      (sum, item) => sum + item.unitPriceUsd * item.quantity,
      0,
    );

    const { shipmentId, rates } = await this.shippoBridge.getRates(
      input.addressFrom,
      input.addressTo,
      input.parcel,
    );

    const orderId = generateId.order();

    await db`
      insert into orders (
        id,
        project_id,
        seller_id,
        buyer_wallet,
        seller_wallet,
        state,
        shippo_shipment_id,
        address_from,
        address_to,
        parcel,
        subtotal_usd,
        total_usd,
        platform_fee_bps
      ) values (
        ${orderId},
        ${projectId},
        ${input.sellerId},
        ${input.buyerWallet},
        ${input.sellerWallet},
        ${OrderState.INITIATED},
        ${shipmentId},
        ${db.json(input.addressFrom as any)},
        ${db.json(input.addressTo as any)},
        ${db.json(input.parcel as any)},
        ${subtotalUsd.toFixed(2)},
        ${subtotalUsd.toFixed(2)},
        250
      )
    `;

    for (const item of input.items) {
      await db`
        insert into order_items (
          id,
          order_id,
          external_item_id,
          name,
          quantity,
          unit_price_usd,
          weight_oz,
          dimensions
        ) values (
          ${`item_${generateId.order()}`},
          ${orderId},
          ${item.externalItemId ?? null},
          ${item.name},
          ${item.quantity},
          ${item.unitPriceUsd.toFixed(2)},
          ${item.weightOz?.toFixed(2) ?? null},
          ${item.dimensions
            ? db.json(item.dimensions as any)
            : null}
        )
      `;
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
    input: SelectShippingInput,
  ): Promise<{
    escrowAmountToken: string;
    exchangeRate: number;
    labelCid: string;
    totalUsd: number;
    shippingCostUsd: number;
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== OrderState.INITIATED) {
      const err: any = new Error(
        `Cannot select shipping in state ${order.state}. Expected INITIATED.`,
      );
      err.statusCode = 409;
      throw err;
    }

    const label = await this.shippoBridge.purchaseLabel(input.rateId);

    const labelCid = await this.pinataBridge.pinFile(label.labelUrl, `label_${orderId}`);

    const shippingCostUsd = parseFloat(label.shippingCostUsd);
    const totalUsd = parseFloat(order.subtotalUsd) + shippingCostUsd;
    const { escrowAmountToken, exchangeRate } = convertOrderTotal(totalUsd);

    await db`
      update orders
      set
        selected_rate_id = ${input.rateId},
        tracking_number = ${label.trackingNumber},
        carrier = ${label.carrier},
        label_url = ${label.labelUrl},
        label_ipfs_cid = ${labelCid},
        shipping_cost_usd = ${shippingCostUsd.toFixed(2)},
        total_usd = ${totalUsd.toFixed(2)},
        escrow_amount_token = ${escrowAmountToken},
        exchange_rate = ${exchangeRate.toFixed(8)},
        updated_at = now()
      where id = ${orderId}
    `;

    return { escrowAmountToken, exchangeRate, labelCid, totalUsd, shippingCostUsd };
  }

  async confirmEscrow(
    orderId: string,
    projectId: string,
    input: ConfirmEscrowInput,
  ): Promise<{
    status: string;
    invoiceCid: string;
    payoutSchedule: PayoutSchedule;
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== OrderState.INITIATED) {
      const err: any = new Error(
        `Cannot confirm escrow in state ${order.state}. Expected INITIATED.`,
      );
      err.statusCode = 409;
      throw err;
    }

    if (!order.escrowAmountToken) {
      const err: any = new Error("Shipping must be selected before confirming escrow");
      err.statusCode = 400;
      throw err;
    }

    const { verified, contractOrderId } = await this.blockchainBridge.verifyEscrowDeposit(
      input.txHash,
      order.escrowAmountToken,
      order.buyerWallet,
    );

    if (!verified) {
      const err: any = new Error("Escrow deposit could not be verified");
      err.statusCode = 400;
      throw err;
    }

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

    const updatedRows = await db<Order[]>`
      update orders
      set
        state = ${OrderState.ESCROWED},
        escrow_tx_hash = ${input.txHash},
        escrow_contract_order_id = ${contractOrderId},
        invoice_ipfs_cid = ${invoiceCid},
        escrowed_at = now(),
        updated_at = now()
      where id = ${orderId}
        and state = ${OrderState.INITIATED}
      returning *
    `;

    if (!updatedRows[0]) {
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
    input: ConfirmLabelPrintedInput,
  ): Promise<{
    status: string;
    payoutAmountToken: string;
    txHash: string;
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== OrderState.ESCROWED) {
      const err: any = new Error(
        `Cannot confirm label printed in state ${order.state}. Expected ESCROWED.`,
      );
      err.statusCode = 409;
      throw err;
    }

    if (input.sellerWallet !== order.sellerWallet) {
      const err: any = new Error("Wallet mismatch - not the order seller");
      err.statusCode = 403;
      throw err;
    }

    const escrowAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;

    const receiptCid = await this.pinataBridge.pinJSON(
      { orderId, state: "LABEL_CREATED", timestamp: new Date().toISOString() },
      `receipt_label_${orderId}`,
    );

    const { txHash: advanceTx } = await this.blockchainBridge.advanceState(
      contractOrderId,
      "LABEL_CREATED",
      receiptCid,
    );

    const { txHash: releaseTx } = await this.blockchainBridge.releasePartial(
      contractOrderId,
      PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
    );

    const payoutAmountToken = bpsOfToken(
      escrowAmountToken,
      PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
    );

    const updatedRows = await db<Order[]>`
      update orders
      set
        state = ${OrderState.LABEL_CREATED},
        label_created_at = now(),
        updated_at = now()
      where id = ${orderId}
        and state = ${OrderState.ESCROWED}
      returning *
    `;

    if (!updatedRows[0]) {
      const err: any = new Error("State transition conflict; please retry");
      err.statusCode = 409;
      throw err;
    }

    await this.payoutService.recordPayout({
      orderId,
      sellerId: order.sellerId,
      state: OrderState.LABEL_CREATED,
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

    return { status: OrderState.LABEL_CREATED, payoutAmountToken, txHash: releaseTx };
  }

  async finalize(
    orderId: string,
    projectId: string,
  ): Promise<{
    status: string;
    finalPayoutToken: string;
    platformFeeToken: string;
    txHash: string;
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== OrderState.DELIVERED) {
      const err: any = new Error(
        `Cannot finalize in state ${order.state}. Expected DELIVERED.`,
      );
      err.statusCode = 409;
      throw err;
    }

    const graceEndsAt = toDate(order.graceEndsAt);
    if (graceEndsAt && graceEndsAt > new Date()) {
      const err: any = new Error(
        `Grace period has not expired yet. Expires at ${graceEndsAt.toISOString()}`,
      );
      err.statusCode = 409;
      throw err;
    }

    const escrowAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;
    const platformFeeBps = order.platformFeeBps;

    const { txHash, sellerAmount, feeAmount } = await this.blockchainBridge.releaseFinal(
      contractOrderId,
      platformFeeBps,
    );

    const updatedRows = await db<Order[]>`
      update orders
      set
        state = ${OrderState.FINALIZED},
        finalized_at = now(),
        updated_at = now()
      where id = ${orderId}
        and state = ${OrderState.DELIVERED}
      returning *
    `;

    if (!updatedRows[0]) {
      const err: any = new Error("State transition conflict; please retry");
      err.statusCode = 409;
      throw err;
    }

    await this.payoutService.recordPayout({
      orderId,
      sellerId: order.sellerId,
      state: OrderState.FINALIZED,
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
      status: OrderState.FINALIZED,
      finalPayoutToken: sellerAmount,
      platformFeeToken: feeAmount,
      txHash,
    };
  }

  async getById(
    orderId: string,
    projectId: string,
  ): Promise<{
    order: Order;
    items: OrderItem[];
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    const items = await db<OrderItem[]>`
      select *
      from order_items
      where order_id = ${orderId}
    `;

    return { order, items };
  }
}
