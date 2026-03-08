"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { AgentChat } from "./AgentChat";
import { clsx } from "clsx";

function cn(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

export interface BuyerChatProps {
  userId: string;
  className?: string;
}

export function BuyerChat({ userId, className }: BuyerChatProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3", className)}>
      {open && (
        <AgentChat
          role="buyer"
          userId={userId}
          variant="floating"
          placeholder="Ask about your order..."
        />
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-500 transition-colors"
        aria-label={open ? "Close chat" : "Open buyer chat"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
