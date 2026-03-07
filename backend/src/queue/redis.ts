import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";
import { env } from "../config/env";

/**
 * We use standalone ioredis for runtime, but bullmq bundles its own copy
 * with incompatible types.  Cast once here so every consumer can use
 * bullmq's ConnectionOptions without "as any" everywhere.
 */
export type RedisConnection = ConnectionOptions;

let redisConnection: RedisConnection | null = null;

/**
 * Creates and returns a Redis connection.
 * Returns null when REDIS_URL is not configured (graceful degradation).
 * Handles both standard Redis and Upstash (TLS) URLs.
 */
export function createRedisConnection(url?: string): RedisConnection | null {
  const redisUrl = url ?? env.REDIS_URL;

  if (!redisUrl) {
    console.log(
      "[redis] REDIS_URL not set — running without Redis (sync fallback mode)",
    );
    return null;
  }

  try {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
    });

    connection.on("connect", () => {
      console.log("[redis] Connected to Redis");
    });

    connection.on("error", (err) => {
      console.error("[redis] Connection error:", err.message);
    });

    return connection as unknown as RedisConnection;
  } catch (err: any) {
    console.error("[redis] Failed to create connection:", err.message);
    return null;
  }
}

/**
 * Returns the singleton Redis connection.
 * Call initializeRedis() first in bootstrap.
 */
export function getRedisConnection(): RedisConnection | null {
  return redisConnection;
}

/**
 * Initializes the singleton Redis connection.
 * Should be called once during app bootstrap.
 */
export function initializeRedis(): RedisConnection | null {
  if (redisConnection) return redisConnection;
  redisConnection = createRedisConnection();
  return redisConnection;
}
