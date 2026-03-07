/**
 * FlowState AI Agents — Nemotron + LangChain + LangGraph
 *
 * Three agents powered by NVIDIA Nemotron via the OpenAI-compatible NIM API.
 * Uses LangGraph createReactAgent with standard tool-calling (MCP pattern).
 */
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { buyerTools } from "@/lib/agents/tools/buyer-tools";
import { sellerTools } from "@/lib/agents/tools/seller-tools";
import { adminTools } from "@/lib/agents/tools/admin-tools";

export type AgentType = "buyer" | "seller" | "admin";

export interface AgentContext {
  buyerWallet?: string;
  sellerId?: string;
  projectId?: string;
}

function createNemotron() {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not set in environment");
  return new ChatOpenAI({
    model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl",
    apiKey,
    temperature: 0.5,
    maxTokens: 1024,
    configuration: {
      baseURL: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    },
  });
}

const BUYER_SYSTEM = `You are a helpful shopping assistant for FlowState, a blockchain-powered escrow e-commerce platform.

You help buyers track orders, understand payment escrow, file disputes, and get receipts.

Key facts about FlowState:
- Payments are held in a smart contract escrow on XRPL EVM testnet
- Funds released in milestones: 15% label printed, 15% shipped, 20% in transit, 35% delivered, 15% finalized
- Currency is FLUSD (Mock RLUSD), pegged to USD
- Order states: INITIATED → ESCROWED → LABEL_CREATED → SHIPPED → IN_TRANSIT → DELIVERED → FINALIZED
- DISPUTED is a branch state when buyer files a dispute

Always use your tools to fetch live data before answering. Give clear, conversational responses — not raw JSON.
Summarize data in plain language.`;

const SELLER_SYSTEM = `You are a data-driven operations assistant for FlowState sellers.

You help sellers manage orders, confirm shipping labels, review payout history, respond to disputes, and track performance.

FlowState payout milestones (minus 2.5% platform fee):
- 15% at LABEL_CREATED, 15% at SHIPPED, 20% at IN_TRANSIT, 35% at DELIVERED, 15% at FINALIZED

Use your tools to pull real data. Format currency as "$X.XX / X.XX FLUSD".
Proactively flag actionable items — ESCROWED orders = immediate revenue opportunity if you print the label.`;

const ADMIN_SYSTEM = `You are a platform operations analyst for FlowState.

You have visibility into platform analytics, seller management, webhook health, and on-chain gas costs.

Your role: help admins understand performance, identify problem sellers, monitor webhooks, and track gas spend.

Always fetch data with tools before answering. Provide analysis and insight — not just raw numbers.
Flag risks, highlight trends, suggest next steps. Keep it clear and executive-friendly.`;

function buildAgent(
  systemPrompt: string,
  tools: DynamicStructuredTool[],
  contextNote?: string
) {
  return createReactAgent({
    llm: createNemotron(),
    tools,
    prompt: contextNote ? `${systemPrompt}\n\n${contextNote}` : systemPrompt,
  });
}

export function createAgent(type: AgentType, context: AgentContext = {}) {
  switch (type) {
    case "buyer":
      return buildAgent(
        BUYER_SYSTEM,
        buyerTools as DynamicStructuredTool[],
        context.buyerWallet
          ? `Current buyer wallet: ${context.buyerWallet}. Use this automatically for wallet-based tool calls unless user specifies another.`
          : undefined
      );
    case "seller":
      return buildAgent(
        SELLER_SYSTEM,
        sellerTools as DynamicStructuredTool[],
        context.sellerId
          ? `Current seller ID: ${context.sellerId}. Use this automatically for seller tool calls unless user specifies another.`
          : undefined
      );
    case "admin":
      return buildAgent(ADMIN_SYSTEM, adminTools as DynamicStructuredTool[]);
    default:
      throw new Error(`Unknown agent type: ${type as string}`);
  }
}
