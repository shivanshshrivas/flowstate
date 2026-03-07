import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { registerRoutes } from "./routes";

// Bridges
import { ShippoBridgeImpl } from "./bridges/shippo.bridge";
import { PinataBridgeStub } from "./bridges/pinata.bridge";
import { BlockchainBridgeStub } from "./bridges/blockchain.bridge";

// Services
import { PayoutService } from "./services/payout.service";
import { WebhookService } from "./services/webhook.service";
import { OrderService } from "./services/order.service";
import { ShippingService } from "./services/shipping.service";
import { SellerService } from "./services/seller.service";
import { DisputeService } from "./services/dispute.service";
import { AuthService } from "./services/auth.service";
import { PlatformService } from "./services/platform.service";
import { WebhookMgmtService } from "./services/webhook-mgmt.service";
import { AgentService } from "./services/agent.service";

// Event listeners (wire up internal pub/sub)
import { flowStateEmitter } from "./events/emitter";

async function bootstrap() {
  // ─── Bridge instances ───────────────────────────────────────────────────────
  const shippoBridge = new ShippoBridgeImpl();
  const pinataBridge = new PinataBridgeStub();
  const blockchainBridge = new BlockchainBridgeStub();

  // ─── Service instances ──────────────────────────────────────────────────────
  const payoutService = new PayoutService();
  const webhookService = new WebhookService();
  const orderService = new OrderService(
    shippoBridge,
    pinataBridge,
    blockchainBridge,
    payoutService
  );
  const shippingService = new ShippingService(
    shippoBridge,
    pinataBridge,
    blockchainBridge,
    payoutService,
    webhookService
  );
  const sellerService = new SellerService();
  const disputeService = new DisputeService(pinataBridge, blockchainBridge);
  const authService = new AuthService();
  const platformService = new PlatformService();
  const webhookMgmtService = new WebhookMgmtService();
  const agentService = new AgentService();

  // ─── Internal event listeners ───────────────────────────────────────────────
  flowStateEmitter.on("order:state_changed", async (event) => {
    await webhookService.dispatch(event.projectId, "order.state_changed", {
      order_id: event.orderId,
      previous_state: event.previousState,
      new_state: event.newState,
      tx_hash: event.txHash,
      timestamp: event.timestamp.toISOString(),
    });
  });

  flowStateEmitter.on("dispute:created", async (event) => {
    await webhookService.dispatch(event.projectId, "dispute.created", {
      dispute_id: event.disputeId,
      order_id: event.orderId,
      buyer_wallet: event.buyerWallet,
      seller_deadline: event.sellerDeadline.toISOString(),
    });
  });

  // ─── Fastify app ────────────────────────────────────────────────────────────
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "warn" : "info",
      transport:
        env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(sensible);

  app.setErrorHandler(errorHandler);

  await registerRoutes(app, {
    orderService,
    shippingService,
    sellerService,
    disputeService,
    authService,
    platformService,
    webhookMgmtService,
    agentService,
  });

  // ─── Start ──────────────────────────────────────────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`FlowState backend running on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
