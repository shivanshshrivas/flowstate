import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { WebhookMgmtService } from "../services/webhook-mgmt.service";

const registerSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
});

export function webhooksRoutes(webhookMgmtService: WebhookMgmtService) {
  return async function (fastify: FastifyInstance) {
    // POST /webhooks/register
    fastify.post("/register", { preHandler: authPreHandler }, async (request, reply) => {
      const body = registerSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: body.error.message },
        });
      }

      const result = await webhookMgmtService.register(request.projectId, body.data);

      return reply.status(201).send({
        success: true,
        data: {
          registration_id: result.registrationId,
          secret: result.secret,
          url: result.url,
          events: result.events,
        },
      });
    });

    // GET /webhooks/logs
    fastify.get("/logs", { preHandler: authPreHandler }, async (request, reply) => {
      const query = request.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50", 10)));

      const result = await webhookMgmtService.getLogs(request.projectId, page, limit);

      return reply.send({ success: true, data: result });
    });
  };
}
