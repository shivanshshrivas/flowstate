import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { DisputeService } from "../services/dispute.service";

const createDisputeSchema = z.object({
  order_id: z.string().min(1),
  reason: z.string().min(1),
  evidence_urls: z.array(z.string().url()).min(1),
});

const respondDisputeSchema = z.object({
  action: z.enum(["accept", "contest"]),
  evidence_urls: z.array(z.string().url()).optional(),
});

const resolveDisputeSchema = z.object({
  resolution: z.enum(["refund", "release", "split"]),
  split_bps: z.number().int().min(0).max(10000).optional(),
});

export function disputesRoutes(disputeService: DisputeService) {
  return async function (fastify: FastifyInstance) {
    // POST /disputes/create
    fastify.post(
      "/create",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const body = createDisputeSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const d = body.data;
        const result = await disputeService.create(request.projectId, {
          orderId: d.order_id,
          reason: d.reason,
          evidenceUrls: d.evidence_urls,
        });

        return reply.status(201).send({
          success: true,
          data: {
            dispute_id: result.disputeId,
            frozen_amount_token: result.frozenAmountToken,
            seller_deadline: result.sellerDeadline,
          },
        });
      }
    );

    // POST /disputes/:id/respond
    fastify.post(
      "/:id/respond",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = respondDisputeSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const d = body.data;
        const result = await disputeService.respond(id, request.projectId, {
          action: d.action,
          evidenceUrls: d.evidence_urls,
        });

        return reply.send({ success: true, data: result });
      }
    );

    // POST /disputes/:id/resolve
    fastify.post(
      "/:id/resolve",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = resolveDisputeSchema.safeParse(request.body);
        if (!body.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: body.error.message },
          });
        }

        const d = body.data;

        if (d.resolution === "split" && d.split_bps === undefined) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "split_bps required for split resolution" },
          });
        }

        const result = await disputeService.resolve(id, request.projectId, {
          resolution: d.resolution,
          splitBps: d.split_bps,
        });

        return reply.send({ success: true, data: result });
      }
    );
  };
}
