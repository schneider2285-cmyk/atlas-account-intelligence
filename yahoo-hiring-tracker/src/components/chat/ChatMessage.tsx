"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";
import { ConfirmationCard } from "./ConfirmationCard";
import { ToolResultCard } from "./ToolResultCard";

// ─── Simple Markdown Renderer ───────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="my-1 ml-4 list-disc space-y-0.5">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list
    if (/^[\-\*]\s+/.test(line)) {
      listItems.push(line.replace(/^[\-\*]\s+/, ""));
      continue;
    }

    flushList();

    // Empty line
    if (!line.trim()) {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = `h${level + 2}` as keyof React.JSX.IntrinsicElements;
      elements.push(
        <Tag key={`h-${i}`} className="font-semibold mt-2 mb-1">
          {renderInline(text)}
        </Tag>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code`, and [links](url)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find the earliest match
    const matches = [
      boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: "link", match: linkMatch, index: linkMatch.index! } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    const { type, match } = first;

    // Text before the match
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    switch (type) {
      case "bold":
        parts.push(
          <strong key={`b-${key++}`}>{match![1]}</strong>
        );
        remaining = remaining.slice(first.index + match![0].length);
        break;
      case "code":
        parts.push(
          <code
            key={`c-${key++}`}
            className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
          >
            {match![1]}
          </code>
        );
        remaining = remaining.slice(first.index + match![0].length);
        break;
      case "link":
        parts.push(
          <a
            key={`a-${key++}`}
            href={match![2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline hover:text-blue-600"
          >
            {match![1]}
          </a>
        );
        remaining = remaining.slice(first.index + match![0].length);
        break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Timestamp Formatter ────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Component ──────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType;
  onConfirmTool?: (toolId: string, confirmed: boolean, edits?: Record<string, unknown>) => void;
}

export function ChatMessage({ message, onConfirmTool }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-2.5 px-3 py-1.5",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Message bubble */}
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm",
              isUser
                ? "rounded-tr-sm bg-blue-600 text-white"
                : "rounded-tl-sm bg-muted text-foreground"
            )}
          >
            {isAssistant ? (
              <div className="space-y-1">{renderMarkdown(message.content)}</div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            )}
          </div>
        )}

        {/* Pending tool confirmations */}
        {message.pendingTools?.map((tool) => (
          <ConfirmationCard
            key={tool.toolId}
            tool={tool}
            onConfirm={(edits) => onConfirmTool?.(tool.toolId, true, edits)}
            onCancel={() => onConfirmTool?.(tool.toolId, false)}
          />
        ))}

        {/* Tool results */}
        {message.toolResults?.map((result, i) => (
          <ToolResultCard key={`${result.toolName}-${i}`} result={result} />
        ))}

        {/* Timestamp */}
        <span className="px-1 text-[10px] text-muted-foreground/60">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
