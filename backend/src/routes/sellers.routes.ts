import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import { callerIdentityPreHandler } from "../middleware/caller-identity";
import { sellerOwnershipPreHandler } from "../middleware/ownership";
import type { SellerService } from "../services/seller.service";

const onboardSchema = z.object({
  wallet_address: z.string().min(1),
  business_name: z.string().min(1),
  business_address: z.object({
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  carrier_accounts: z.record(z.string()).optional(),
  payout_config: z
    .object({
      labelCreatedBps: z.number().int().min(0),
      shippedBps: z.number().int().min(0),
      deliveredBps: z.number().int().min(0),
      finalizedBps: z.number().int().min(0),
    })
    .optional(),
});

export function sellersRoutes(sellerService: SellerService) {
  return async function (fastify: FastifyInstance) {
    // POST /sellers/onboard
    fastify.post(
      "/onboard",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const body = onboardSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const d = body.data;
        const seller = await sellerService.onboard(request.projectId, {
          walletAddress: d.wallet_address,
          businessName: d.business_name,
          businessAddress: d.business_address,
          carrierAccounts: d.carrier_accounts,
          payoutConfig: d.payout_config,
        });

        return reply.status(201).send({ success: true, data: { seller } });
      }
    );

    // GET /sellers/:id/orders
    fastify.get(
      "/:id/orders",
      { preHandler: [authPreHandler, callerIdentityPreHandler, sellerOwnershipPreHandler] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as Record<string, string>;

        const result = await sellerService.getOrders(
          id,
          request.projectId,
          query.status,
          Number(query.page ?? 1),
          Number(query.limit ?? 20)
        );

        return reply.send({ success: true, data: result });
      }
    );

    // GET /sellers/:id/metrics?period=30d
    fastify.get(
      "/:id/metrics",
      { preHandler: [authPreHandler, callerIdentityPreHandler, sellerOwnershipPreHandler] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as Record<string, string>;
        const periodDays = parseInt(query.period ?? "30", 10);

        const metrics = await sellerService.getMetrics(id, request.projectId, periodDays);
        return reply.send({ success: true, data: metrics });
      }
    );

    // GET /sellers/:id/payouts
    fastify.get(
      "/:id/payouts",
      { preHandler: [authPreHandler, callerIdentityPreHandler, sellerOwnershipPreHandler] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as Record<string, string>;

        const result = await sellerService.getPayouts(
          id,
          request.projectId,
          Number(query.page ?? 1),
          Number(query.limit ?? 20)
        );

        return reply.send({ success: true, data: result });
      }
    );
  };
}
