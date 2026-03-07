"use client";

// UI placeholder — will be replaced by <BuyerChat /> / <SellerChat /> / <AdminChat />
// from @flowstate/gateway when the AI agent layer is built.

import { useState } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AgentType = "buyer" | "seller" | "admin";
export type AgentContext = Record<string, unknown>;

interface AgentChatProps {
  agentType: AgentType;
  context?: AgentContext;
  agentName?: string;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_NAMES: Record<AgentType, string> = {
  buyer: "Shopping Assistant",
  seller: "Seller Assistant",
  admin: "Admin Analyst",
};

export default function AgentChat({
  agentType,
  agentName,
  placeholder = "Ask me anything…",
  suggestions = [],
  className,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const displayName = agentName ?? DEFAULT_NAMES[agentType];

  function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      {
        role: "assistant",
        content:
          "AI agents are coming soon — this will be powered by the FlowState gateway. Stay tuned!",
      },
    ]);
  }

  return (
    <div
      className={cn(
        "flex flex-col h-[560px] rounded-xl border border-neutral-800 bg-neutral-950",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
        <Bot className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-neutral-200">{displayName}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Coming soon
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Bot className="h-8 w-8 text-neutral-700" />
            <p className="text-sm text-neutral-500">
              Ask about orders, shipping, or anything else.
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 rounded-full text-xs border border-neutral-700 text-neutral-400 hover:border-violet-600 hover:text-violet-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center mt-0.5">
                  <Bot className="h-3 w-3 text-violet-400" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-neutral-900 text-neutral-300 border border-neutral-800"
                )}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center mt-0.5">
                  <User className="h-3 w-3 text-neutral-400" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-neutral-800">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="flex-1 min-h-[38px] max-h-[120px] bg-neutral-900 border-neutral-700 text-sm"
          />
          <Button
            size="icon"
            variant="outline"
            disabled={!input.trim()}
            onClick={() => sendMessage()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-600">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
