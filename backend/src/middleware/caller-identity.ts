import type { FastifyRequest, FastifyReply } from "fastify";

// Augment Fastify request with caller identity fields extracted from headers.
declare module "fastify" {
  interface FastifyRequest {
    callerUserId?: string;
    callerRole?: string;
  }
}

/**
 * Prehandler: extracts X-Caller-User-Id and X-Caller-Role headers set by
 * the Pinata skill scripts and attaches them to the request for downstream
 * ownership checks. No-op when headers are absent (backward compatible).
 */
export async function callerIdentityPreHandler(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const userId = request.headers["x-caller-user-id"];
  const role = request.headers["x-caller-role"];
  if (typeof userId === "string" && userId.length > 0) {
    request.callerUserId = userId;
  }
  if (typeof role === "string" && role.length > 0) {
    request.callerRole = role;
  }
}
