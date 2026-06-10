"use client";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";
import type { AgentSessionStatus } from "@prisma/client";

const STATUS_STYLES: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  PENDING:        { label: "agent queued",   cls: "text-violet-700 bg-violet-50 ring-violet-200" },
  ACTIVE:         { label: "agent working",  cls: "text-blue-700 bg-blue-50 ring-blue-200", pulse: true },
  AWAITING_INPUT: { label: "needs your input", cls: "text-amber-700 bg-amber-50 ring-amber-300" },
  NEEDS_REVIEW:   { label: "review agent work", cls: "text-orange-700 bg-orange-50 ring-orange-300" },
  COMPLETE:       { label: "agent done",     cls: "text-green-700 bg-green-50 ring-green-200" },
  ERROR:          { label: "agent error",    cls: "text-rose-700 bg-rose-50 ring-rose-200" },
  STALE:          { label: "agent stalled",  cls: "text-slate-600 bg-slate-100 ring-slate-200" },
};

export function AgentBadge({ status, className }: { status: AgentSessionStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  if (!style) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ring-1",
        style.cls,
        className
      )}
      data-testid="agent-badge"
    >
      <Bot className={cn("h-3 w-3", style.pulse && "animate-pulse")} />
      {style.label}
    </span>
  );
}
