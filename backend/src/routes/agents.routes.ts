import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { AgentService } from "../services/agent.service";

const chatSchema = z.object({
  role: z.enum(["buyer", "seller", "admin"]),
  user_id: z.string().min(1),
  message: z.string().min(1),
});

export function agentsRoutes(agentService: AgentService) {
  return async function (fastify: FastifyInstance) {
    // POST /agents/chat
    fastify.post("/chat", { preHandler: authPreHandler }, async (request, reply) => {
      const body = chatSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: body.error.message },
        });
      }

      const { role, user_id, message } = body.data;
      const result = await agentService.chat(request.projectId, role, user_id, message);

      return reply.send({
        success: true,
        data: {
          response: result.response,
          role: result.role,
          suggested_actions: result.suggestedActions,
        },
      });
    });
  };
}
