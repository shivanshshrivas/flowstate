import type { FastifyInstance } from "fastify";
import { ordersRoutes } from "./orders.routes";
import { shippingRoutes } from "./shipping.routes";
import { sellersRoutes } from "./sellers.routes";
import { disputesRoutes } from "./disputes.routes";
import { authRoutes } from "./auth.routes";
import { platformRoutes } from "./platform.routes";
import { webhooksRoutes } from "./webhooks.routes";
import { agentsRoutes } from "./agents.routes";
import type { OrderService } from "../services/order.service";
import type { ShippingService } from "../services/shipping.service";
import type { SellerService } from "../services/seller.service";
import type { DisputeService } from "../services/dispute.service";
import type { AuthService } from "../services/auth.service";
import type { PlatformService } from "../services/platform.service";
import type { WebhookMgmtService } from "../services/webhook-mgmt.service";
import type { AgentService } from "../services/agent.service";

export interface RouteServices {
  orderService: OrderService;
  shippingService: ShippingService;
  sellerService: SellerService;
  disputeService: DisputeService;
  authService: AuthService;
  platformService: PlatformService;
  webhookMgmtService: WebhookMgmtService;
  agentService: AgentService;
}

export async function registerRoutes(
  fastify: FastifyInstance,
  services: RouteServices
): Promise<void> {
  const prefix = "/api/v1";

  fastify.register(ordersRoutes(services.orderService), { prefix: `${prefix}/orders` });
  fastify.register(shippingRoutes(services.shippingService), { prefix: `${prefix}/shipping` });
  fastify.register(sellersRoutes(services.sellerService), { prefix: `${prefix}/sellers` });
  fastify.register(disputesRoutes(services.disputeService), { prefix: `${prefix}/disputes` });
  fastify.register(authRoutes(services.authService), { prefix: `${prefix}/auth` });
  fastify.register(platformRoutes(services.platformService), { prefix: `${prefix}/platform` });
  fastify.register(webhooksRoutes(services.webhookMgmtService), { prefix: `${prefix}/webhooks` });
  fastify.register(agentsRoutes(services.agentService), { prefix: `${prefix}/agents` });

  // Health check
  fastify.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });
}
