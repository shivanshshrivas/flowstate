"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { useFlowState } from "./FlowStateProvider";
import { type ChatMessage, type SuggestedAction } from "./types/index";
import { clsx } from "clsx";

function cn(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

export interface AgentChatProps {
  role: "buyer" | "seller" | "admin";
  userId: string;
  variant?: "floating" | "inline" | "panel";
  className?: string;
  placeholder?: string;
}

export function AgentChat({
  role,
  userId,
  variant = "inline",
  className,
  placeholder = "Ask me anything...",
}: AgentChatProps) {
  const { apiClient } = useFlowState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSuggestedActions([]);
    setLoading(true);

    try {
      if (!apiClient) {
        throw new Error("API client not configured. Set baseUrl in FlowStateProvider config.");
      }

      const response = await apiClient.chatWithAgent({
        role,
        user_id: userId,
        message: text.trim(),
        session_id: sessionId,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (response.suggested_actions) {
        setSuggestedActions(response.suggested_actions);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  const containerClass = cn(
    "flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden",
    variant === "panel" && "h-full",
    variant === "inline" && "h-[28rem]",
    variant === "floating" && "h-[24rem] w-80 shadow-2xl",
    className
  );

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <Bot className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-neutral-200 capitalize">
          {role} Agent
        </span>
        <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" title="Online" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-500 text-center mt-4">
            Hi! I'm your {role} assistant. How can I help?
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2 max-w-[90%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                msg.role === "user"
                  ? "bg-violet-600"
                  : "bg-neutral-700"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-3.5 w-3.5 text-white" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-neutral-300" />
              )}
            </div>
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-neutral-800 text-neutral-200"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 mr-auto">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-700 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-neutral-300" />
            </div>
            <div className="rounded-xl bg-neutral-800 px-3 py-2">
              <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested actions */}
      {suggestedActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestedActions.map((action, i) => (
            <button
              key={i}
              onClick={() => sendMessage(action.label)}
              className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-neutral-800 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 outline-none border border-neutral-700 focus:border-violet-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
