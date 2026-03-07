import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { AuthService } from "../services/auth.service";

const createProjectSchema = z.object({
  name: z.string().min(1),
  owner_email: z.string().email(),
  platform_fee_wallet: z.string().min(1),
  platform_fee_bps: z.number().int().min(0).max(10000).optional(),
  contracts: z.record(z.string()).optional(),
});

const rotateKeySchema = z.object({
  label: z.string().optional(),
});

export function authRoutes(authService: AuthService) {
  return async function (fastify: FastifyInstance) {
    // POST /auth/projects/create — no auth required (bootstrap)
    fastify.post("/projects/create", async (request, reply) => {
      const body = createProjectSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: body.error.message },
        });
      }

      const d = body.data;
      const result = await authService.createProject({
        name: d.name,
        ownerEmail: d.owner_email,
        platformFeeWallet: d.platform_fee_wallet,
        platformFeeBps: d.platform_fee_bps,
        contracts: d.contracts,
      });

      return reply.status(201).send({
        success: true,
        data: {
          project_id: result.projectId,
          api_key: result.apiKey,
        },
      });
    });

    // POST /auth/api-keys/rotate — requires auth
    fastify.post("/api-keys/rotate", { preHandler: authPreHandler }, async (request, reply) => {
      const body = rotateKeySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: body.error.message },
        });
      }

      const result = await authService.rotateApiKey(request.projectId, body.data.label);

      return reply.send({
        success: true,
        data: {
          api_key_id: result.apiKeyId,
          api_key: result.apiKey,
        },
      });
    });
  };
}
