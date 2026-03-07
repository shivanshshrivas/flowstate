import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client";
import type { ApiKey } from "../db/types";
import { hashApiKey } from "../utils/crypto";

// Augment Fastify's request type to carry the resolved projectId.
declare module "fastify" {
  interface FastifyRequest {
    projectId: string;
  }
}

/**
 * Prehandler for API key auth.
 * Parses `Authorization: Bearer fs_live_key_xyz`, looks up by prefix,
 * compares full SHA-256 hash, attaches projectId to request.
 */
export async function authPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "MISSING_API_KEY",
        message: "Authorization: Bearer <key> is required",
      },
    });
  }

  const key = authHeader.slice(7).trim();

  if (key.length < 16) {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_API_KEY", message: "Invalid API key format" },
    });
  }

  const keyPrefix = key.slice(0, 16);
  const keyHash = hashApiKey(key);

  const rows = await db<ApiKey[]>`
    select *
    from api_keys
    where key_prefix = ${keyPrefix}
      and key_hash = ${keyHash}
      and is_active = true
    limit 1
  `;

  const apiKey = rows[0];

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "API key not found or inactive",
      },
    });
  }

  // Non-blocking update of lastUsedAt
  db`
    update api_keys
    set last_used_at = now(), updated_at = now()
    where id = ${apiKey.id}
  `.catch(() => {
    /* ignore */
  });

  request.projectId = apiKey.projectId;
}