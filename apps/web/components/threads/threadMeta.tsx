import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  taskflow: "TaskFlow agent",
  claude: "Claude",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
  other: "Other",
};

export const LINKABLE_PROVIDERS = ["claude", "claude-code", "codex", "gemini", "other"] as const;

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Working", cls: "text-sky-600 bg-sky-500/10 ring-sky-500/25" },
  WAITING: { label: "Needs you", cls: "text-amber-600 bg-amber-500/10 ring-amber-500/30" },
  DONE: { label: "Done", cls: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/25" },
};

export function ThreadStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "text-muted-foreground bg-muted ring-border" };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md ring-1 shrink-0", s.cls)}>
      {s.label}
    </span>
  );
}
