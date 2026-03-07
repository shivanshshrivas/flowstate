import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authPreHandler } from "../middleware/auth";
import type { ShippingService } from "../services/shipping.service";

const addressSchema = z.object({
  name: z.string(),
  company: z.string().optional(),
  street1: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const parcelSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  distanceUnit: z.enum(["cm", "in"]),
  weight: z.number().positive(),
  massUnit: z.enum(["g", "kg", "lb", "oz"]),
});

export function shippingRoutes(shippingService: ShippingService) {
  return async function (fastify: FastifyInstance) {
    // POST /shipping/webhook/shippo — no auth (called directly by Shippo)
    fastify.post("/webhook/shippo", async (request, reply) => {
      const result = await shippingService.processWebhook(request.body);
      return reply.send({ ok: true, result });
    });

    // GET /shipping/rates?from=...&to=...&parcel=...
    fastify.get(
      "/rates",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const query = request.query as Record<string, string>;

        const fromParsed = z.string().safeParse(query.from);
        const toParsed = z.string().safeParse(query.to);
        const parcelParsed = z.string().safeParse(query.parcel);

        if (!fromParsed.success || !toParsed.success || !parcelParsed.success) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Query params from, to, and parcel are required (JSON-encoded)",
            },
          });
        }

        let from: unknown, to: unknown, parcel: unknown;
        try {
          from = JSON.parse(fromParsed.data);
          to = JSON.parse(toParsed.data);
          parcel = JSON.parse(parcelParsed.data);
        } catch {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Query params must be valid JSON" },
          });
        }

        const fromResult = addressSchema.safeParse(from);
        const toResult = addressSchema.safeParse(to);
        const parcelResult = parcelSchema.safeParse(parcel);

        if (!fromResult.success || !toResult.success || !parcelResult.success) {
          return reply.status(400).send({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid address or parcel shape" },
          });
        }

        const result = await shippingService.getRates(
          fromResult.data,
          toResult.data,
          parcelResult.data
        );

        return reply.send({ success: true, data: result });
      }
    );

    // GET /shipping/track/:orderId
    fastify.get(
      "/track/:orderId",
      { preHandler: authPreHandler },
      async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const result = await shippingService.getTracking(orderId);
        return reply.send({ success: true, data: result });
      }
    );
  };
}
