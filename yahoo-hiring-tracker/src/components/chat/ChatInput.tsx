"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────

const MAX_CHARS = 2000;
const TOPTAL_URL_PATTERN = /https?:\/\/(?:www\.)?toptal\.com\/[\w\-\/]+/i;

// ─── Component ──────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Detect Toptal URLs on change
  useEffect(() => {
    const match = value.match(TOPTAL_URL_PATTERN);
    setDetectedUrl(match ? match[0] : null);
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setDetectedUrl(null);
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text/plain");
      const match = pasted.match(TOPTAL_URL_PATTERN);
      if (match) {
        setDetectedUrl(match[0]);
      }
    },
    []
  );

  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = value.trim().length > 0 && !disabled && !isOverLimit;

  return (
    <div className="border-t bg-background px-3 pb-3 pt-2">
      {/* URL detection indicator */}
      {detectedUrl && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          <Link2 className="size-3 shrink-0" />
          <span className="truncate">Toptal URL detected: {detectedUrl}</span>
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? "Waiting for response..." : "Type a message..."}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed",
            "placeholder:text-muted-foreground/50",
            "outline-none transition-colors",
            "focus:border-ring focus:ring-2 focus:ring-ring/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isOverLimit && "border-destructive focus:ring-destructive/20"
          )}
          style={{ minHeight: "40px", maxHeight: "160px" }}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "mb-0.5 size-9 shrink-0 rounded-xl transition-all",
            canSend
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Send className="size-4" />
        </Button>
      </div>

      {/* Character count */}
      <div className="mt-1 flex items-center justify-between px-1">
        <span className="text-[10px] text-muted-foreground/50">
          Shift+Enter for new line
        </span>
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isOverLimit
              ? "text-destructive"
              : charCount > MAX_CHARS * 0.9
                ? "text-yellow-600"
                : "text-muted-foreground/40"
          )}
        >
          {charCount > 0 && `${charCount}/${MAX_CHARS}`}
        </span>
      </div>
    </div>
  );
}
