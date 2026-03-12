"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Trash2, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

// ─── Typing Indicator ───────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5">
      <div className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="size-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
        <MessageSquare className="size-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Hiring Assistant</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Ask me to create jobs, submit candidates, check pipeline status, or
          update submission stages. Paste Toptal URLs for quick imports.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {[
          "Show me the pipeline",
          "Create a new iOS job",
          "Submit a candidate",
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Drawer ────────────────────────────────────────────────────

export function ChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    confirmTool,
    clearMessages,
    clearError,
  } = useChat();

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, isOpen]);

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "hover:scale-105 active:scale-95",
          isOpen
            ? "bg-foreground text-background"
            : "bg-blue-600 text-white hover:bg-blue-700"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <X className="size-5" />
        ) : (
          <MessageSquare className="size-5" />
        )}
      </button>

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-[400px] flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Bot className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Hiring Assistant</h2>
              <p className="text-[10px] text-muted-foreground">
                Powered by Claude
              </p>
            </div>
          </div>

          {hasMessages && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearMessages}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Clear chat"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2">
            <AlertCircle className="size-3.5 shrink-0 text-destructive" />
            <p className="flex-1 text-xs text-destructive">{error}</p>
            <button
              onClick={clearError}
              className="text-xs font-medium text-destructive underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Messages area */}
        <ScrollArea className="flex-1">
          <div className="flex min-h-full flex-col">
            {hasMessages ? (
              <div className="flex-1 py-3">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onConfirmTool={(toolId, confirmed, edits) =>
                      confirmTool(toolId, confirmed, edits)
                    }
                  />
                ))}

                {/* Typing indicator */}
                {(isLoading || isStreaming) &&
                  messages[messages.length - 1]?.content === "" && (
                    <TypingIndicator />
                  )}

                {/* Scroll anchor */}
                <div ref={scrollEndRef} className="h-px" />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </>
  );
}
