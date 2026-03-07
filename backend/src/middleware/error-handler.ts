import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";

/**
 * Global Fastify error handler — normalises all errors into the standard
 * ApiResponse shape so clients always get { success, error: { code, message } }.
 */
export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  // Fastify validation errors (JSON Schema / Zod)
  if (error.validation) {
    reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.validation,
      },
    });
    return;
  }

  // Known HTTP errors (from @fastify/sensible or explicit status codes)
  if (error.statusCode) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code ?? "HTTP_ERROR",
        message: error.message,
      },
    });
    return;
  }

  // Unexpected server errors — don't leak details in production
  console.error("[error-handler]", error);
  reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
