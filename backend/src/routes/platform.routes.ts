import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { PlatformService } from "../services/platform.service";

const PERIOD_MAP: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function platformRoutes(platformService: PlatformService) {
  return async function (fastify: FastifyInstance) {
    // GET /platform/:projectId/analytics
    fastify.get("/:projectId/analytics", { preHandler: authPreHandler }, async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      if (projectId !== request.projectId) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "You can only access your own project analytics" },
        });
      }

      const { period = "30d" } = request.query as { period?: string };
      const periodDays = PERIOD_MAP[period] ?? 30;

      const result = await platformService.getAnalytics(projectId, periodDays);

      return reply.send({ success: true, data: result });
    });

    // GET /platform/:projectId/sellers
    fastify.get("/:projectId/sellers", { preHandler: authPreHandler }, async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      if (projectId !== request.projectId) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "You can only access your own project data" },
        });
      }

      const query = request.query as { flagged?: string; page?: string; limit?: string };
      const flagged = query.flagged === "true";
      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));

      const result = await platformService.getSellers(projectId, flagged, page, limit);

      return reply.send({ success: true, data: result });
    });

    // GET /platform/:projectId/gas-costs
    fastify.get("/:projectId/gas-costs", { preHandler: authPreHandler }, async (request, reply) => {
      const { projectId } = request.params as { projectId: string };

      if (projectId !== request.projectId) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "You can only access your own project data" },
        });
      }

      const result = await platformService.getGasCosts(projectId);

      return reply.send({ success: true, data: result });
    });
  };
}
