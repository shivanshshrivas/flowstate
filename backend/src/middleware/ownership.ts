import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client";
import type { Order, Dispute } from "../db/types";

/**
 * Verifies that a seller can only access their own data via routes like
 * GET /sellers/:id/orders, GET /sellers/:id/metrics, GET /sellers/:id/payouts.
 * The :id path param must equal the callerUserId.
 * No-op when no caller identity is present (non-agent callers pass through).
 */
export async function sellerOwnershipPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { callerUserId, callerRole } = request;
  if (!callerUserId || callerRole !== "seller") return;

  const { id } = request.params as { id: string };
  if (id !== callerUserId) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Access denied to another seller's data" },
    });
  }
}

/**
 * Verifies that a buyer can only access their own order via GET /orders/:id.
 * Checks order.buyerWallet === callerUserId.
 * No-op when no caller identity is present.
 */
export async function buyerOrderOwnershipPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { callerUserId, callerRole } = request;
  if (!callerUserId || callerRole !== "buyer") return;

  const { id } = request.params as { id: string };
  const rows = await db<Pick<Order, "buyerWallet">[]>`
    select buyer_wallet
    from orders
    where id = ${id}
      and project_id = ${request.projectId}
    limit 1
  `;

  const order = rows[0];
  if (!order || order.buyerWallet !== callerUserId) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Access denied to another buyer's order" },
    });
  }
}

/**
 * Verifies that a seller can only respond to disputes on their own orders via
 * POST /disputes/:id/respond. Checks dispute.sellerWallet === callerUserId.
 * No-op when no caller identity is present.
 */
export async function sellerDisputeOwnershipPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { callerUserId, callerRole } = request;
  if (!callerUserId || callerRole !== "seller") return;

  const { id } = request.params as { id: string };
  // Disputes don't have project_id; scope via the linked order.
  const rows = await db<Pick<Dispute, "sellerWallet">[]>`
    select d.seller_wallet
    from disputes d
    join orders o on o.id = d.order_id
    where d.id = ${id}
      and o.project_id = ${request.projectId}
    limit 1
  `;

  const dispute = rows[0];
  if (!dispute || dispute.sellerWallet !== callerUserId) {
    return reply.status(403).send({
      success: false,
      error: { code: "FORBIDDEN", message: "Access denied to another seller's dispute" },
    });
  }
}
