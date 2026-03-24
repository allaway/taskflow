"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { CheckCircle2, Circle, ChevronRight, Sunrise } from "lucide-react";
import type { Task } from "@prisma/client";
import { toast } from "sonner";

interface PlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onDone: () => void;
}

type Step = "select" | "estimate" | "intention";

export function PlanningModal({ open, onOpenChange, date, onDone }: PlanningModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [intention, setIntention] = useState("");
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelected(new Set());
    setDurations({});
    setIntention("");
    setLoading(true);
    fetch("/api/tasks?status=INBOX")
      .then((r) => r.ok ? r.json() : [])
      .then((tasks: Task[]) => { setInboxTasks(tasks); setLoading(false); });
  }, [open]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) { onOpenChange(false); onDone(); return; }
    setApplying(true);
    const selectedTasks = inboxTasks.filter((t) => selected.has(t.id));
    await Promise.all(selectedTasks.map((task) =>
      fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: startOfDay(date).toISOString(),
          status: "SCHEDULED",
          duration: durations[task.id] ? parseInt(durations[task.id]) : task.duration ?? 30,
        }),
      })
    ));
    setApplying(false);
    toast.success(`${selected.size} task${selected.size > 1 ? "s" : ""} added to ${format(date, "EEEE")}`);
    onOpenChange(false);
    onDone();
  }

  const selectedTasks = inboxTasks.filter((t) => selected.has(t.id));
  const totalMins = selectedTasks.reduce((acc, t) => {
    const d = durations[t.id] ? parseInt(durations[t.id]) : (t.duration ?? 30);
    return acc + d;
  }, 0);
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sunrise className="h-4 w-4 text-amber-400" />
            Plan your {format(date, "EEEE")}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          {(["select", "estimate", "intention"] as Step[]).map((s, i) => (
            <span key={s} className={cn("flex items-center gap-1", step === s && "text-foreground font-medium")}>
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {i + 1}. {s === "select" ? "Pick tasks" : s === "estimate" ? "Set times" : "Intention"}
            </span>
          ))}
        </div>

        {/* ── Step 1: Select tasks ─────────────────────────────────────────── */}
        {step === "select" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Which inbox tasks do you want to work on today?</p>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)
              ) : inboxTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-6">Inbox is empty — nothing to pull in.</p>
              ) : (
                inboxTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleSelect(task.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                      selected.has(task.id)
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/40 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    {selected.has(task.id)
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    }
                    <span className="text-sm truncate">{task.title}</span>
                    {task.duration && (
                      <span className="ml-auto text-[11px] text-muted-foreground/50 shrink-0">{task.duration}m</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => selected.size > 0 ? setStep("estimate") : apply()} disabled={loading}>
                  {selected.size === 0 ? "Skip" : "Next →"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Estimate durations ───────────────────────────────────── */}
        {step === "estimate" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">How long will each task take? (minutes)</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selectedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                  <span className="flex-1 text-sm truncate">{task.title}</span>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    step={15}
                    placeholder="30"
                    value={durations[task.id] ?? (task.duration?.toString() ?? "")}
                    onChange={(e) => setDurations((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    className="h-7 w-20 text-xs bg-transparent border-border/40 focus-visible:ring-0 text-right"
                  />
                  <span className="text-[11px] text-muted-foreground/50">min</span>
                </div>
              ))}
            </div>
            {totalMins > 0 && (
              <p className="text-xs text-muted-foreground/70 text-right">
                Total: {totalH > 0 ? `${totalH}h ` : ""}{totalM > 0 ? `${totalM}m` : ""}
              </p>
            )}
            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep("select")}>← Back</Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => setStep("intention")}>Next →</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Daily intention ──────────────────────────────────────── */}
        {step === "intention" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">What&apos;s your focus for today? (optional)</p>
            <Input
              placeholder="e.g. Ship the auth feature, or just have a good day."
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
              autoFocus
              className="bg-muted/40 border-border/60 focus-visible:ring-0 focus-visible:border-primary/60"
            />
            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setStep("estimate")}>← Back</Button>
              <Button size="sm" className="h-8 text-xs" onClick={apply} disabled={applying}>
                {applying ? "Applying…" : "Start day →"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
