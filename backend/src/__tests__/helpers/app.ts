import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { errorHandler } from "../../middleware/error-handler";
import { registerRoutes, type RouteServices } from "../../routes";

// Default stub services that return minimal values.
// Override any service in tests by passing a partial RouteServices object.
const noopService = new Proxy(
  {},
  {
    get: () => () => {
      throw new Error("Service method not mocked");
    },
  },
);

export async function buildTestApp(
  serviceOverrides: Partial<RouteServices> = {},
) {
  const app = Fastify({ logger: false });

  await app.register(sensible);
  app.setErrorHandler(errorHandler);

  const services: RouteServices = {
    orderService: noopService as any,
    shippingService: noopService as any,
    sellerService: noopService as any,
    disputeService: noopService as any,
    authService: noopService as any,
    platformService: noopService as any,
    webhookMgmtService: noopService as any,
    agentService: noopService as any,
    ...serviceOverrides,
  };

  await registerRoutes(app, services);
  await app.ready();

  return app;
}
