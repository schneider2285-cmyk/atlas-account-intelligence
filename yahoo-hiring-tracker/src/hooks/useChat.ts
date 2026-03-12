"use client";

import { useState, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  pendingTools?: PendingTool[];
  toolResults?: ToolResult[];
}

export interface PendingTool {
  toolId: string;
  toolName: string;
  description: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  result: Record<string, unknown>;
}

type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_pending"; toolId: string; toolName: string; description: string; params: Record<string, unknown> }
  | { type: "tool_result"; toolName: string; result: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  confirmTool: (toolId: string, confirmed: boolean, edits?: Record<string, unknown>) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "yahoo-hiring-chat-messages";

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    saveMessages(msgs);
  }, []);

  // Parse a streaming response from /api/chat
  const processStream = useCallback(
    async (response: Response, assistantMsgId: string) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No readable stream in response");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      const pendingTools: PendingTool[] = [];
      const toolResults: ToolResult[] = [];

      setIsStreaming(true);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(trimmed) as StreamEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case "text":
                accumulatedText += event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulatedText }
                      : m
                  )
                );
                break;

              case "tool_pending":
                pendingTools.push({
                  toolId: event.toolId,
                  toolName: event.toolName,
                  description: event.description,
                  params: event.params,
                });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, pendingTools: [...pendingTools] }
                      : m
                  )
                );
                break;

              case "tool_result":
                toolResults.push({
                  toolName: event.toolName,
                  result: event.result,
                });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, toolResults: [...toolResults] }
                      : m
                  )
                );
                break;

              case "error":
                setError(event.message);
                break;

              case "done":
                break;
            }
          }
        }
      } finally {
        reader.releaseLock();
        setIsStreaming(false);
      }

      // Persist final state
      setMessages((prev) => {
        const final = prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: accumulatedText,
                pendingTools: pendingTools.length > 0 ? pendingTools : undefined,
                toolResults: toolResults.length > 0 ? toolResults : undefined,
              }
            : m
        );
        saveMessages(final);
        return final;
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMsg, assistantMsg];
      setMessages(updatedMessages);

      // Build the messages payload (exclude the empty assistant placeholder)
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`Chat API error: ${response.status} — ${errorText}`);
        }

        await processStream(response, assistantMsg.id);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const cleaned = prev.filter((m) => m.id !== assistantMsg.id);
          saveMessages(cleaned);
          return cleaned;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, processStream]
  );

  const confirmTool = useCallback(
    async (toolId: string, confirmed: boolean, edits?: Record<string, unknown>) => {
      setError(null);
      setIsLoading(true);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, assistantMsg];
        return updated;
      });

      const apiMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            confirmTool: { toolId, confirmed, edits },
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`Chat API error: ${response.status} — ${errorText}`);
        }

        await processStream(response, assistantMsg.id);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Failed to confirm tool";
        setError(message);
        setMessages((prev) => {
          const cleaned = prev.filter((m) => m.id !== assistantMsg.id);
          saveMessages(cleaned);
          return cleaned;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, processStream]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    persistMessages([]);
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
  }, [persistMessages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    confirmTool,
    clearMessages,
    clearError,
  };
}
