import type { BaseMessage } from "@langchain/core/messages";
import { config } from "../config.js";

export type AgentType = "buyer" | "seller" | "admin";

export interface Session {
  id: string;
  agentType: AgentType;
  userId: string; // buyer_wallet or seller_id; "admin" for admin sessions
  chatHistory: BaseMessage[];
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionContext {
  userId: string;
  agentType: AgentType;
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(
      () => this.sweepExpiredSessions(),
      config.SESSION_CLEANUP_INTERVAL_MS,
    );
    // Allow the process to exit even if the timer is still running
    this.cleanupTimer.unref?.();
  }

  /**
   * Creates a new session. Throws if the session cap has been reached.
   */
  create(agentType: AgentType, userId: string): Session {
    if (this.sessions.size >= config.MAX_SESSIONS) {
      throw new Error(
        `Session cap reached (${config.MAX_SESSIONS}). Please try again later.`,
      );
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const session: Session = {
      id,
      agentType,
      userId,
      chatHistory: [],
      createdAt: now,
      lastActiveAt: now,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Returns the session if it exists and has not expired, or null.
   */
  get(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const isExpired = Date.now() - session.lastActiveAt > config.SESSION_TTL_MS;
    if (isExpired) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Updates the chat history for a session and bumps its lastActiveAt.
   */
  update(sessionId: string, chatHistory: BaseMessage[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.chatHistory = chatHistory;
    session.lastActiveAt = Date.now();
  }

  /**
   * Resolves or creates a session for an incoming MCP tool call.
   *
   * Returns `{ session, isNew, wasExpired }` so callers can inform the user
   * when a previous session has expired.
   */
  resolve(
    agentType: AgentType,
    userId: string,
    sessionId?: string,
  ): { session: Session; isNew: boolean; wasExpired: boolean } {
    if (sessionId) {
      const existing = this.get(sessionId);
      if (existing) {
        return { session: existing, isNew: false, wasExpired: false };
      }
      // Session was provided but not found — create a fresh one
      const session = this.create(agentType, userId);
      return { session, isNew: true, wasExpired: true };
    }

    const session = this.create(agentType, userId);
    return { session, isNew: true, wasExpired: false };
  }

  /** Returns the number of active (non-expired) sessions. */
  get activeCount(): number {
    return this.sessions.size;
  }

  /** Deletes sessions that have exceeded TTL. */
  private sweepExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActiveAt > config.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }
}
