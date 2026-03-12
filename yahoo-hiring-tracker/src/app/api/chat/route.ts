import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";
import { anthropic, MODEL } from "@/server/claude/client";
import { buildSystemPrompt } from "@/server/claude/system-prompt";
import { TOOL_DEFINITIONS, TOOL_NAMES, type ToolName } from "@/server/claude/tools";
import { executeTool, type ToolResult } from "@/server/claude/executor";
import type Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────

/** Matches what useChat sends */
interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  /** When confirming/rejecting a tool call */
  confirmTool?: {
    toolId: string;
    confirmed: boolean;
    edits?: Record<string, unknown>;
  };
}

// ─── Helpers: streaming protocol ───────────────────────────────────
// The client (useChat) expects newline-delimited JSON, NOT SSE.
// Each line is a JSON object: {"type":"text","content":"..."}\n

function encodeEvent(encoder: TextEncoder, event: Record<string, unknown>): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

// ─── POST /api/chat ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
  }

  // ── Handle tool confirmation flow ──────────────────────────────
  if (body.confirmTool) {
    return handleToolConfirmation(body, userId);
  }

  // ── Handle normal message flow ─────────────────────────────────
  return handleChatMessage(body, userId);
}

// ─── Normal Chat Message ───────────────────────────────────────────

async function handleChatMessage(body: ChatRequestBody, userId: string) {
  const systemPrompt = await buildSystemPrompt();

  // Convert client messages to Anthropic format
  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Store the user message (the last one in the array)
  const lastUserMsg = body.messages[body.messages.length - 1];
  if (lastUserMsg?.role === "user") {
    await db.chatMessage.create({
      data: {
        userId,
        role: "user",
        content: lastUserMsg.content,
      },
    });
  }

  // Stream the response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamClaudeResponse(controller, encoder, systemPrompt, messages, userId);
        controller.enqueue(encodeEvent(encoder, { type: "done" }));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encodeEvent(encoder, { type: "error", message }));
        controller.enqueue(encodeEvent(encoder, { type: "done" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Stream Claude Response (with automatic tool loop) ─────────────

async function streamClaudeResponse(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  userId: string,
): Promise<void> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    tools: TOOL_DEFINITIONS,
    messages,
    stream: true,
  });

  let assistantText = "";
  const toolUseBlocks: Array<{
    id: string;
    name: string;
    input: unknown;
  }> = [];
  let currentToolUse: {
    id: string;
    name: string;
    inputJson: string;
  } | null = null;

  for await (const event of response) {
    switch (event.type) {
      case "content_block_start": {
        const block = event.content_block;
        if (block.type === "tool_use") {
          currentToolUse = {
            id: block.id,
            name: block.name,
            inputJson: "",
          };
        }
        break;
      }

      case "content_block_delta": {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          assistantText += delta.text;
          controller.enqueue(
            encodeEvent(encoder, { type: "text", content: delta.text })
          );
        } else if (delta.type === "input_json_delta" && currentToolUse) {
          currentToolUse.inputJson += delta.partial_json;
        }
        break;
      }

      case "content_block_stop": {
        if (currentToolUse) {
          let parsedInput: unknown;
          try {
            parsedInput = JSON.parse(currentToolUse.inputJson);
          } catch {
            parsedInput = {};
          }
          toolUseBlocks.push({
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: parsedInput,
          });
          currentToolUse = null;
        }
        break;
      }
    }
  }

  // If Claude wants to use tools
  if (toolUseBlocks.length > 0) {
    // Check if all tools are read-only (auto-execute without confirmation)
    const allReadOnly = toolUseBlocks.every(
      (t) => t.name === "query_pipeline" || t.name === "search_candidates"
    );

    if (allReadOnly) {
      // Auto-execute read-only tools and continue the conversation
      const toolResults = await executeAllTools(toolUseBlocks, userId);

      // Send tool results to the client for display
      for (let i = 0; i < toolUseBlocks.length; i++) {
        controller.enqueue(
          encodeEvent(encoder, {
            type: "tool_result",
            toolName: toolUseBlocks[i].name,
            result: toolResults[i],
          })
        );
      }

      // Build the assistant content for the conversation
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (assistantText) {
        assistantContent.push({ type: "text", text: assistantText });
      }
      for (const block of toolUseBlocks) {
        assistantContent.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }

      const toolResultContent: Anthropic.ToolResultBlockParam[] = toolResults.map(
        (result, i) => ({
          type: "tool_result" as const,
          tool_use_id: toolUseBlocks[i].id,
          content: JSON.stringify(result),
        })
      );

      const followUpMessages: Anthropic.MessageParam[] = [
        ...messages,
        { role: "assistant", content: assistantContent },
        { role: "user", content: toolResultContent },
      ];

      // Stream the follow-up response (recursive — handles chained tool calls)
      await streamClaudeResponse(controller, encoder, systemPrompt, followUpMessages, userId);

      // Store the full assistant response
      if (assistantText) {
        await db.chatMessage.create({
          data: {
            userId,
            role: "assistant",
            content: assistantText,
            toolCalls: toolResults as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } else {
      // Mutation tools — require user confirmation
      // Send each tool as a pending confirmation event
      for (const t of toolUseBlocks) {
        controller.enqueue(
          encodeEvent(encoder, {
            type: "tool_pending",
            toolId: t.id,
            toolName: t.name,
            description: describeToolCall(t.name as ToolName, t.input),
            params: t.input as Record<string, unknown>,
          })
        );
      }

      // Store partial assistant message with tool calls for later confirmation
      await db.chatMessage.create({
        data: {
          userId,
          role: "assistant",
          content: assistantText || "(awaiting tool confirmation)",
          toolCalls: toolUseBlocks as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } else {
    // No tool calls — just text response
    if (assistantText) {
      await db.chatMessage.create({
        data: {
          userId,
          role: "assistant",
          content: assistantText,
        },
      });
    }
  }
}

// ─── Tool Confirmation ─────────────────────────────────────────────

async function handleToolConfirmation(body: ChatRequestBody, userId: string) {
  const { toolId, confirmed, edits } = body.confirmTool!;

  if (!confirmed) {
    // User rejected — store rejection and return a simple message
    await db.chatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: "Tool call was cancelled by user.",
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encodeEvent(encoder, {
            type: "text",
            content: "Understood — I've cancelled that action. How would you like to proceed?",
          })
        );
        controller.enqueue(encodeEvent(encoder, { type: "done" }));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // User confirmed — find the pending tool call from the conversation history
  // Look up the most recent assistant message with tool calls for this user
  const recentAssistantMsg = await db.chatMessage.findFirst({
    where: {
      userId,
      role: "assistant",
      toolCalls: { not: Prisma.JsonNull },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!recentAssistantMsg?.toolCalls) {
    return NextResponse.json(
      { error: "No pending tool calls found" },
      { status: 400 }
    );
  }

  // Parse the stored tool calls
  const storedToolCalls = recentAssistantMsg.toolCalls as unknown as Array<{
    id: string;
    name: string;
    input: unknown;
  }>;

  // Find the specific tool call by ID
  const toolCall = storedToolCalls.find((t) => t.id === toolId);
  if (!toolCall) {
    return NextResponse.json(
      { error: `Tool call ${toolId} not found` },
      { status: 400 }
    );
  }

  // Apply edits if provided
  const finalInput = edits
    ? { ...(toolCall.input as Record<string, unknown>), ...edits }
    : toolCall.input;

  if (!TOOL_NAMES.has(toolCall.name)) {
    return NextResponse.json(
      { error: `Unknown tool: ${toolCall.name}` },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Execute the confirmed tool
        const toolResult = await executeTool(
          toolCall.name as ToolName,
          finalInput,
          userId
        );

        // Send the tool result to the client
        controller.enqueue(
          encodeEvent(encoder, {
            type: "tool_result",
            toolName: toolCall.name,
            result: toolResult,
          })
        );

        // Build conversation for Claude to summarize the result
        const systemPrompt = await buildSystemPrompt();

        const assistantContent: Anthropic.ContentBlockParam[] = [
          {
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.name,
            input: finalInput as Record<string, unknown>,
          },
        ];

        const toolResultContent: Anthropic.ToolResultBlockParam[] = [
          {
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ];

        // Rebuild conversation from what the client sent, plus tool context
        const conversationMessages: Anthropic.MessageParam[] = body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const followUpMessages: Anthropic.MessageParam[] = [
          ...conversationMessages,
          { role: "assistant", content: assistantContent },
          { role: "user", content: toolResultContent },
        ];

        // Stream Claude's summary
        const followUpResponse = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          messages: followUpMessages,
          stream: true,
        });

        let fullText = "";
        for await (const event of followUpResponse) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            controller.enqueue(
              encodeEvent(encoder, { type: "text", content: event.delta.text })
            );
          }
        }

        // Store the assistant's summary
        if (fullText) {
          await db.chatMessage.create({
            data: {
              userId,
              role: "assistant",
              content: fullText,
              toolCalls: [toolResult] as unknown as Prisma.InputJsonValue,
            },
          });
        }

        controller.enqueue(encodeEvent(encoder, { type: "done" }));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encodeEvent(encoder, { type: "error", message }));
        controller.enqueue(encodeEvent(encoder, { type: "done" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

async function executeAllTools(
  tools: Array<{ id: string; name: string; input: unknown }>,
  userId: string
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const tool of tools) {
    const result = await executeTool(tool.name as ToolName, tool.input, userId);
    results.push(result);
  }

  return results;
}

function describeToolCall(toolName: ToolName, input: unknown): string {
  const data = input as Record<string, unknown>;

  switch (toolName) {
    case "create_job":
      return `Create job: "${data.roleTitle}" for ${data.projectName} (${data.businessUnit})`;
    case "submit_candidate":
      return `Submit ${data.candidateName} to "${data.jobIdentifier}"`;
    case "update_submission_status":
      return `Update ${data.submissionIdentifier} → ${data.newStatus}`;
    case "log_followup":
      return `Log follow-up for "${data.jobIdentifier}" with ${data.contactPerson}`;
    case "query_pipeline":
      return `Query pipeline${data.jobIdentifier ? `: ${data.jobIdentifier}` : ""}${data.businessUnit ? ` (${data.businessUnit})` : ""}`;
    case "search_candidates":
      return `Search candidates${data.name ? `: name="${data.name}"` : ""}${data.location ? ` location="${data.location}"` : ""}`;
    default:
      return `Execute ${toolName}`;
  }
}

// ─── GET /api/chat — Fetch conversation history ────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const messages = await db.chatMessage.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    select: {
      id: true,
      role: true,
      content: true,
      toolCalls: true,
      createdAt: true,
    },
  });

  let nextCursor: string | undefined;
  if (messages.length > limit) {
    const next = messages.pop();
    nextCursor = next?.id;
  }

  // Return in chronological order
  messages.reverse();

  return NextResponse.json({ messages, nextCursor });
}
