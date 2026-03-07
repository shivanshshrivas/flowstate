import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { OrderService } from "../services/order.service";

const createOrderSchema = z.object({
  seller_id: z.string().min(1),
  buyer_wallet: z.string().min(1),
  seller_wallet: z.string().min(1),
  address_from: z.object({
    name: z.string(),
    company: z.string().optional(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  address_to: z.object({
    name: z.string(),
    company: z.string().optional(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  parcel: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    distanceUnit: z.enum(["cm", "in"]),
    weight: z.number().positive(),
    massUnit: z.enum(["g", "kg", "lb", "oz"]),
  }),
  items: z
    .array(
      z.object({
        externalItemId: z.string().optional(),
        name: z.string(),
        quantity: z.number().int().positive(),
        unitPriceUsd: z.number().positive(),
        weightOz: z.number().positive().optional(),
        dimensions: z
          .object({
            length: z.number(),
            width: z.number(),
            height: z.number(),
            unit: z.string(),
          })
          .optional(),
      })
    )
    .min(1),
});

const selectShippingSchema = z.object({
  rate_id: z.string().min(1),
});

const confirmEscrowSchema = z.object({
  tx_hash: z.string().min(1),
});

const confirmLabelPrintedSchema = z.object({
  seller_wallet: z.string().min(1),
});

export function ordersRoutes(orderService: OrderService) {
  return async function (fastify: FastifyInstance) {
    // POST /orders/create
    fastify.post(
      "/create",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const body = createOrderSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const d = body.data;
        const result = await orderService.create(request.projectId, {
          items: d.items,
          sellerId: d.seller_id,
          buyerWallet: d.buyer_wallet,
          sellerWallet: d.seller_wallet,
          addressFrom: d.address_from,
          addressTo: d.address_to,
          parcel: d.parcel,
        });

        return reply.status(201).send({
          success: true,
          data: {
            order_id: result.orderId,
            shipping_options: result.shippingOptions,
            escrow_address: result.escrowAddress,
            subtotal_usd: result.subtotalUsd,
          },
        });
      }
    );

    // POST /orders/:id/select-shipping
    fastify.post(
      "/:id/select-shipping",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = selectShippingSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const result = await orderService.selectShipping(id, request.projectId, {
          rateId: body.data.rate_id,
        });

        return reply.send({
          success: true,
          data: {
            escrow_amount_token: result.escrowAmountToken,
            exchange_rate: result.exchangeRate,
            label_cid: result.labelCid,
            total_usd: result.totalUsd,
            shipping_cost_usd: result.shippingCostUsd,
          },
        });
      }
    );

    // POST /orders/:id/confirm-escrow
    fastify.post(
      "/:id/confirm-escrow",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = confirmEscrowSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const result = await orderService.confirmEscrow(id, request.projectId, {
          txHash: body.data.tx_hash,
        });

        return reply.send({
          success: true,
          data: {
            status: result.status,
            invoice_cid: result.invoiceCid,
            payout_schedule: result.payoutSchedule,
          },
        });
      }
    );

    // POST /orders/:id/confirm-label-printed
    fastify.post(
      "/:id/confirm-label-printed",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = confirmLabelPrintedSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const result = await orderService.confirmLabelPrinted(id, request.projectId, {
          sellerWallet: body.data.seller_wallet,
        });

        return reply.send({
          success: true,
          data: {
            status: result.status,
            payout_amount_token: result.payoutAmountToken,
            tx_hash: result.txHash,
          },
        });
      }
    );

    // POST /orders/:id/finalize
    fastify.post(
      "/:id/finalize",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await orderService.finalize(id, request.projectId);

        return reply.send({
          success: true,
          data: {
            status: result.status,
            final_payout_token: result.finalPayoutToken,
            platform_fee_token: result.platformFeeToken,
            tx_hash: result.txHash,
          },
        });
      }
    );

    // GET /orders/:id
    fastify.get(
      "/:id",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const { order, items } = await orderService.getById(id, request.projectId);

        return reply.send({
          success: true,
          data: { order, items },
        });
      }
    );
  };
}
