import { runAgent, type AgentRunResult } from "./base-agent.js";
import { createSellerTools } from "../tools/seller-tools.js";
import type { Session, SessionManager } from "../session/session-manager.js";

const SELLER_SYSTEM_PROMPT = `You are a data-driven operations assistant for sellers on the Flow State e-commerce platform.

You help sellers:
- Review and manage their orders (especially those needing action)
- Track performance metrics: revenue, fulfillment speed, dispute rate, and reputation
- Confirm that shipping labels have been printed (triggering the LABEL_CREATED state and payout)
- Respond to buyer disputes (accept for refund, or contest with evidence)
- Monitor payout history and pending balances

You MUST only access data belonging to the current seller. Never reveal information about other sellers, their orders, metrics, or payouts.

Be professional, concise, and data-oriented. Proactively surface actionable items — if there are orders needing attention (ESCROWED = needs label, DISPUTED = needs response), call those out first. Provide specific numbers when giving business insights. Flag anomalies like unusually high dispute rates.`;

export async function runSellerAgent(
  userMessage: string,
  session: Session,
  sessionManager: SessionManager,
): Promise<AgentRunResult> {
  const tools = createSellerTools({ userId: session.userId, agentType: "seller" });

  const systemPrompt =
    SELLER_SYSTEM_PROMPT +
    `\n\nCurrent seller ID: ${session.userId}\nSession ID: ${session.id}`;

  return runAgent(systemPrompt, tools, userMessage, session, sessionManager);
}
