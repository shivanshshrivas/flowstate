import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { registerRoutes } from "./routes";

// Bridges
import { ShippoBridgeImpl } from "./bridges/shippo.bridge";
import { PinataBridgeImpl } from "./bridges/pinata.bridge";
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

// Redis + BullMQ
import { initializeRedis, getRedisConnection } from "./queue/redis";
import { initializeQueues } from "./queue/queues";
import { startWorkers } from "./queue/workers";
import type { ConnectionOptions } from "bullmq";

// WebSocket
import { registerWebSocket, broadcastToProject } from "./ws";

// Cron
import { startCronJobs, startCronFallback } from "./cron/scheduler";

async function bootstrap() {
  // ─── Bridge instances ───────────────────────────────────────────────────────
  const shippoBridge = new ShippoBridgeImpl();
  const pinataBridge = new PinataBridgeImpl();
  const blockchainBridge = new BlockchainBridgeStub();

  // ─── Service instances ──────────────────────────────────────────────────────
  const payoutService = new PayoutService();
  const webhookService = new WebhookService();
  const orderService = new OrderService(
    shippoBridge,
    pinataBridge,
    blockchainBridge,
    payoutService,
  );
  const shippingService = new ShippingService(
    shippoBridge,
    pinataBridge,
    blockchainBridge,
    payoutService,
    webhookService,
  );
  const sellerService = new SellerService();
  const disputeService = new DisputeService(pinataBridge, blockchainBridge);
  const authService = new AuthService();
  const platformService = new PlatformService();
  const webhookMgmtService = new WebhookMgmtService();
  const agentService = new AgentService();

  // ─── Redis + BullMQ (optional) ──────────────────────────────────────────────
  initializeRedis();
  const redis = getRedisConnection();

  if (redis) {
    const queues = initializeQueues();
    const connection = redis as unknown as ConnectionOptions;

    if (queues) {
      // Start workers (pass bridges + services as dependencies)
      startWorkers(connection, {
        pinataBridge,
        blockchainBridge,
        payoutService,
        agentService,
        broadcastToProject,
      });

      // Start cron jobs
      startCronJobs(connection, {
        orderService,
        blockchainBridge,
      });
    }
  } else {
    // Start cron fallback (setInterval)
    startCronFallback({
      orderService,
      blockchainBridge,
    });
  }

  // ─── Internal event listeners ───────────────────────────────────────────────

  // Determine webhook dispatch method: use queue when available, else inline
  const dispatchWebhook = redis
    ? webhookService.enqueueDispatch.bind(webhookService)
    : webhookService.dispatch.bind(webhookService);

  flowStateEmitter.on("order:state_changed", async (event) => {
    const data = {
      order_id: event.orderId,
      previous_state: event.previousState,
      new_state: event.newState,
      tx_hash: event.txHash,
      timestamp: event.timestamp.toISOString(),
    };

    // Webhook dispatch
    await dispatchWebhook(event.projectId, "order.state_changed", data);

    // WebSocket broadcast
    broadcastToProject(event.projectId, "order_state_changed", data);
  });

  flowStateEmitter.on("dispute:created", async (event) => {
    const data = {
      dispute_id: event.disputeId,
      order_id: event.orderId,
      buyer_wallet: event.buyerWallet,
      seller_deadline: event.sellerDeadline.toISOString(),
    };

    await dispatchWebhook(event.projectId, "dispute.created", data);
    broadcastToProject(event.projectId, "dispute_created", data);
  });

  // Wire previously unwired events
  flowStateEmitter.on("dispute:resolved", async (event) => {
    const data = {
      dispute_id: event.disputeId,
      order_id: event.orderId,
      resolution: event.resolution,
      tx_hash: event.txHash,
    };

    await dispatchWebhook(event.projectId, "dispute.resolved", data);
  });

  flowStateEmitter.on("payout:recorded", async (event) => {
    if (!event.projectId) return;
    const data = {
      payout_id: event.payoutId,
      order_id: event.orderId,
      seller_id: event.sellerId,
      state: event.state,
      amount_token: event.amountToken,
      tx_hash: event.txHash,
    };
    await dispatchWebhook(event.projectId, "payout.released", data);
    broadcastToProject(event.projectId, "payout_released", data);
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

  // Register WebSocket plugin
  await registerWebSocket(app);

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
    console.log(
      `Redis: ${redis ? "connected" : "unavailable (sync fallback mode)"}`,
    );
    console.log(`WebSocket: ws://0.0.0.0:${env.PORT}/ws`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
