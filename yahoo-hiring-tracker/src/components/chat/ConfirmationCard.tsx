"use client";

import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PendingTool } from "@/hooks/useChat";

// ─── Helpers ────────────────────────────────────────────────────────

function formatParamKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ─── Component ──────────────────────────────────────────────────────

interface ConfirmationCardProps {
  tool: PendingTool;
  onConfirm: (edits?: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ConfirmationCard({
  tool,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedParams, setEditedParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, value] of Object.entries(tool.params)) {
      initial[key] = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    }
    return initial;
  });
  const [isActioned, setIsActioned] = useState(false);

  const handleConfirm = () => {
    setIsActioned(true);
    if (isEditing) {
      // Parse edited values back
      const edits: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editedParams)) {
        try {
          edits[key] = JSON.parse(value);
        } catch {
          edits[key] = value;
        }
      }
      onConfirm(edits);
    } else {
      onConfirm();
    }
  };

  const handleCancel = () => {
    setIsActioned(true);
    onCancel();
  };

  if (isActioned) {
    return null;
  }

  return (
    <Card size="sm" className="w-full border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold text-amber-800 dark:text-amber-200">
          Confirm Action
        </CardTitle>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {tool.description}
        </p>
      </CardHeader>

      <CardContent>
        {/* Parameter table */}
        <div className="rounded-md border border-amber-200/80 bg-white/60 dark:border-amber-800/30 dark:bg-black/20">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(tool.params).map(([key, value]) => (
                <tr
                  key={key}
                  className="border-b border-amber-100 last:border-0 dark:border-amber-900/30"
                >
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-muted-foreground">
                    {formatParamKey(key)}
                  </td>
                  <td className="px-2.5 py-1.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedParams[key] ?? ""}
                        onChange={(e) =>
                          setEditedParams((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-black/30"
                      />
                    ) : (
                      <span className="text-foreground">
                        {formatParamValue(value)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="xs"
            onClick={handleConfirm}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Check className="size-3" />
            {isEditing ? "Save & Confirm" : "Confirm"}
          </Button>

          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
          >
            <Pencil className="size-3" />
            {isEditing ? "Cancel Edit" : "Edit"}
          </Button>

          <Button
            size="xs"
            variant="destructive"
            onClick={handleCancel}
          >
            <X className="size-3" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
