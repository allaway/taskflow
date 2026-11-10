"use client";
import { useEffect, useState } from "react";
import { format, startOfDay } from "date-fns";
import { CheckCircle2, Circle, Layers, Loader2, Sparkles, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMinutes, projectDay } from "@/lib/projection";
import type { NewTaskProposal, PlanItem, PlanProposal } from "@/lib/services/planner";

interface PlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onDone: () => void;
  /** Called after a plan is applied, to offer follow-up adjustments. */
  onAdjust?: () => void;
}

type TaskInfo = Record<string, { title: string; priority: string; onDay: boolean }>;

/**
 * The daily planning ritual: say what matters today, review the plan built
 * around it, apply. Nothing changes until "Apply plan".
 */
export function PlanningModal({ open, onOpenChange, date, onDone, onAdjust }: PlanningModalProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const [intent, setIntent] = useState("");
  const [building, setBuilding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [tasks, setTasks] = useState<TaskInfo>({});
  const [usedAi, setUsedAi] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let active = true;
    setProposal(null);
    setExcluded(new Set());
    setIntent("");
    fetch(`/api/plan?date=${dateStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.plan?.intent) setIntent(d.plan.intent);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, dateStr]);

  async function build() {
    setBuilding(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          intent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.proposal) {
        toast.error(typeof data?.error === "string" ? data.error : "Couldn't build a plan");
        return;
      }
      setProposal(data.proposal);
      setTasks(data.tasks ?? {});
      setUsedAi(data.usedAi !== false);
      setExcluded(new Set());
    } catch {
      toast.error("Couldn't build a plan");
    } finally {
      setBuilding(false);
    }
  }

  function toggle(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const items: PlanItem[] = proposal?.items.filter((i) => !excluded.has(i.taskId)) ?? [];
  const newTasks: NewTaskProposal[] = proposal?.newTasks.filter((_, i) => !excluded.has(`new-${i}`)) ?? [];
  const projection = projectDay([
    ...items.map((i) => ({ id: i.taskId, startTime: i.startTime, duration: i.duration, parallel: i.parallel })),
    ...newTasks.map((t, i) => ({ id: `new-${i}`, startTime: t.startTime, duration: t.duration, parallel: t.parallel })),
  ]);

  async function apply(planned: boolean) {
    setApplying(true);
    try {
      const res = await fetch("/api/plan/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          scheduledDate: startOfDay(date).toISOString(),
          intent,
          summary: planned ? proposal?.summary ?? null : undefined,
          items: planned ? items : [],
          newTasks: planned ? newTasks : [],
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't apply the plan");
        return;
      }
      const count = planned ? items.length + newTasks.length : 0;
      toast.success(
        count > 0 ? `${count} task${count === 1 ? "" : "s"} planned for ${format(date, "EEEE")}` : "Intention saved",
        onAdjust && count > 0 ? { action: { label: "Adjust", onClick: onAdjust }, duration: 8000 } : undefined
      );
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Couldn't apply the plan");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sunrise className="h-4 w-4 text-amber-400" />
            Plan your {format(date, "EEEE")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {proposal
              ? "Review the plan. Untick anything you don't want; nothing changes until you apply."
              : "Say what matters and a plan is built around it from your calendar, tasks, agent threads and catch-up."}
          </DialogDescription>
        </DialogHeader>

        {!proposal ? (
          <div className="space-y-3">
            <Textarea
              autoFocus
              rows={4}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) build();
              }}
              placeholder="What really matters today? e.g. Get the grant report to a full draft; keep the afternoon light, I have three reviews running with agents."
              className="resize-none text-sm bg-muted/40 border-border/60 focus-visible:ring-0 focus-visible:border-primary/60"
              data-testid="plan-intent-input"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => apply(false)}
                disabled={building || applying || !intent.trim()}
                title="Save this as today's intention and plan the day yourself"
              >
                Just save intention
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={build} disabled={building} data-testid="ai-schedule-btn">
                  {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {building ? "Building plan…" : "Build my plan"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-0">
            {proposal.summary && (
              <p className={cn("text-sm leading-relaxed rounded-lg px-3 py-2.5", usedAi ? "bg-primary/5 text-foreground/90" : "bg-muted/50 text-muted-foreground")}>
                {proposal.summary}
              </p>
            )}

            <div className="space-y-1 overflow-y-auto min-h-0 pr-1">
              {proposal.items.length === 0 && proposal.newTasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nothing to schedule.</p>
              )}
              {proposal.items.map((item) => (
                <PlanRow
                  key={item.taskId}
                  included={!excluded.has(item.taskId)}
                  onToggle={() => toggle(item.taskId)}
                  time={item.startTime}
                  title={tasks[item.taskId]?.title ?? "Task"}
                  duration={item.duration}
                  parallel={item.parallel}
                  badge={tasks[item.taskId]?.onDay ? null : "from inbox"}
                />
              ))}
              {proposal.newTasks.map((t, i) => (
                <PlanRow
                  key={`new-${i}`}
                  included={!excluded.has(`new-${i}`)}
                  onToggle={() => toggle(`new-${i}`)}
                  time={t.startTime}
                  title={t.title}
                  duration={t.duration}
                  parallel={t.parallel}
                  badge="new task"
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 shrink-0">
              <span className="text-xs text-muted-foreground" title="Parallel tasks that overlap count once">
                {formatMinutes(projection.wallMinutes)} of your day
                {projection.effortMinutes !== projection.wallMinutes && (
                  <span className="text-muted-foreground/60"> · {formatMinutes(projection.effortMinutes)} of work</span>
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setProposal(null)} disabled={applying}>
                  ← Back
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={build} disabled={building || applying}>
                  {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Rebuild"}
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => apply(true)} disabled={applying || building} data-testid="accept-schedule-btn">
                  {applying ? "Applying…" : "Apply plan"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanRow({
  included,
  onToggle,
  time,
  title,
  duration,
  parallel,
  badge,
}: {
  included: boolean;
  onToggle: () => void;
  time: string | null;
  title: string;
  duration: number;
  parallel: boolean;
  badge: string | null;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-all",
        included ? "border-border/60 bg-muted/20" : "border-border/30 opacity-50"
      )}
    >
      {included ? (
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      )}
      <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">{time ?? "—"}</span>
      <span className="flex-1 text-sm truncate">{title}</span>
      {badge && (
        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">{badge}</span>
      )}
      {parallel && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-violet-600 bg-violet-500/10 px-1.5 py-0.5 rounded-md shrink-0" title="Runs alongside other parallel tasks">
          <Layers className="h-3 w-3" /> parallel
        </span>
      )}
      <span className="text-xs text-muted-foreground/70 shrink-0 tabular-nums">{duration}m</span>
    </button>
  );
}
