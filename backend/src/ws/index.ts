import type { FastifyInstance } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { db } from "../db/client";
import type { ApiKey } from "../db/types";
import { hashApiKey } from "../utils/crypto";
import type { WsIncoming, WsOutgoing } from "./types";

// Connection registry
const projectSockets = new Map<string, Set<WebSocket>>();

/**
 * Broadcast an event to all connected WebSocket clients for a given project.
 */
export function broadcastToProject(
  projectId: string,
  event: string,
  data: unknown,
): void {
  const sockets = projectSockets.get(projectId);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify({ type: event, data });

  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }
}

/**
 * Returns the number of connected clients for a project (useful for monitoring).
 */
export function getProjectConnectionCount(projectId: string): number {
  return projectSockets.get(projectId)?.size ?? 0;
}

const AUTH_TIMEOUT_MS = 5_000;

async function authenticateSocket(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;

  const keyPrefix = token.slice(0, 16);
  const keyHash = hashApiKey(token);

  try {
    const rows = await db<ApiKey[]>`
      select *
      from api_keys
      where key_prefix = ${keyPrefix}
        and key_hash = ${keyHash}
        and is_active = true
      limit 1
    `;

    return rows[0]?.projectId ?? null;
  } catch {
    return null;
  }
}

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(fastifyWebsocket);

  app.get("/ws", { websocket: true }, (socket, _request) => {
    let authenticated = false;
    let projectId: string | null = null;

    const authTimer = setTimeout(() => {
      if (!authenticated) {
        const msg: WsOutgoing = {
          type: "error",
          message: "Authentication timeout",
        };
        socket.send(JSON.stringify(msg));
        socket.close(4001, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    socket.on("message", async (raw: Buffer | string) => {
      let parsed: WsIncoming;
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid JSON",
          } satisfies WsOutgoing),
        );
        return;
      }

      if (parsed.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" } satisfies WsOutgoing));
        return;
      }

      if (parsed.type === "auth") {
        if (authenticated) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Already authenticated",
            } satisfies WsOutgoing),
          );
          return;
        }

        projectId = await authenticateSocket(parsed.token);

        if (!projectId) {
          const msg: WsOutgoing = { type: "error", message: "Invalid API key" };
          socket.send(JSON.stringify(msg));
          socket.close(4003, "Invalid API key");
          clearTimeout(authTimer);
          return;
        }

        authenticated = true;
        clearTimeout(authTimer);

        if (!projectSockets.has(projectId)) {
          projectSockets.set(projectId, new Set());
        }
        projectSockets.get(projectId)!.add(socket);

        return;
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimer);
      if (projectId) {
        const sockets = projectSockets.get(projectId);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            projectSockets.delete(projectId);
          }
        }
      }
    });

    socket.on("error", () => {
      clearTimeout(authTimer);
      if (projectId) {
        const sockets = projectSockets.get(projectId);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            projectSockets.delete(projectId);
          }
        }
      }
    });
  });
}