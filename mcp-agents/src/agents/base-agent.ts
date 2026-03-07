import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { config } from "../config.js";
import type { Session } from "../session/session-manager.js";
import type { SessionManager } from "../session/session-manager.js";

export interface AgentRunResult {
  response: string;
  session_id: string;
}

/**
 * Runs a single turn of the agent loop:
 * 1. Loads history from session
 * 2. Appends user message
 * 3. Invokes the model (with bound tools) in a ReAct-style loop
 * 4. Saves updated history back to session
 * 5. Returns the final text response
 */
export async function runAgent(
  systemPrompt: string,
  tools: StructuredToolInterface[],
  userMessage: string,
  session: Session,
  sessionManager: SessionManager,
): Promise<AgentRunResult> {
  // NVIDIA NIM is OpenAI-compatible — use ChatOpenAI with NVIDIA's base URL
  const model = new ChatOpenAI({
    openAIApiKey: config.NVIDIA_API_KEY,
    modelName: config.NVIDIA_MODEL,
    temperature: 0.1,
    configuration: {
      baseURL: "https://integrate.api.nvidia.com/v1",
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelWithTools = model.bindTools(tools as any);

  const toolMap = new Map(tools.map((t) => [t.name, t]));

  // Build message list: system prompt + persisted history + new user turn
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...session.chatHistory,
    new HumanMessage(userMessage),
  ];

  // ReAct-style tool-calling loop
  let finalResponse = "";
  const MAX_ITERATIONS = 20; // guard against infinite loops

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (modelWithTools as any).invoke(messages);
    messages.push(response as AIMessage);

    const toolCalls =
      (response as AIMessage).tool_calls ?? [];

    if (toolCalls.length === 0) {
      // No more tool calls — extract the final text
      const content = (response as AIMessage).content;
      finalResponse =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("")
            : String(content);
      break;
    }

    // Execute each tool call and append results
    for (const toolCall of toolCalls) {
      const toolFn = toolMap.get(toolCall.name);
      let result: string;

      if (!toolFn) {
        result = `Unknown tool: "${toolCall.name}"`;
      } else {
        try {
          const raw = await toolFn.invoke(toolCall.args);
          result = typeof raw === "string" ? raw : JSON.stringify(raw);
        } catch (err) {
          result = `Tool "${toolCall.name}" failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      messages.push(
        new ToolMessage({
          content: result,
          tool_call_id: toolCall.id ?? `call-${Date.now()}`,
          name: toolCall.name,
        }),
      );
    }
  }

  if (!finalResponse) {
    finalResponse =
      "I reached the maximum number of reasoning steps. Please try rephrasing your request.";
  }

  // Persist history (everything after the system prompt)
  sessionManager.update(session.id, messages.slice(1));

  return { response: finalResponse, session_id: session.id };
}
