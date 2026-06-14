"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay } from "date-fns";
import { CheckCircle2, Circle, MoveRight, Inbox, Moon } from "lucide-react";
import type { Task } from "@prisma/client";
import { toast } from "sonner";

interface ShutdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  tasks: Task[];
  completedToday?: Task[];
  onDone: () => void;
}

type Disposition = "defer" | "inbox" | "keep";

export function ShutdownModal({ open, onOpenChange, date, tasks, completedToday = [], onDone }: ShutdownModalProps) {
  // Merge tasks completed today from any source (scheduled for today or via MCP/API)
  const completedIds = new Set(completedToday.map((t) => t.id));
  const todayCompleted = [
    ...completedToday,
    ...tasks.filter((t) => t.status === "COMPLETED" && !completedIds.has(t.id)),
  ];
  const incomplete = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [applying, setApplying] = useState(false);

  // Reset dispositions whenever the modal opens so stale choices don't persist
  useEffect(() => {
    if (open) setDispositions({});
  }, [open]);

  function setAll(d: Disposition) {
    const next: Record<string, Disposition> = {};
    incomplete.forEach((t) => (next[t.id] = d));
    setDispositions(next);
  }

  async function finishDay() {
    setApplying(true);
    const tomorrow = startOfDay(addDays(date, 1)).toISOString();
    await Promise.all(
      incomplete.map((task) => {
        const d = dispositions[task.id] ?? "keep";
        if (d === "defer") {
          return fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledDate: tomorrow }),
          });
        } else if (d === "inbox") {
          return fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledDate: null, startTime: null, status: "INBOX" }),
          });
        }
        return Promise.resolve();
      })
    );
    setApplying(false);
    toast.success("Day complete. Good work!");
    onOpenChange(false);
    onDone();
  }

  const deferCount = incomplete.filter((t) => (dispositions[t.id] ?? "keep") === "defer").length;
  const inboxCount = incomplete.filter((t) => (dispositions[t.id] ?? "keep") === "inbox").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4 text-indigo-400" />
            Finish {format(date, "EEEE")}
          </DialogTitle>
        </DialogHeader>

        {/* Completed summary */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-400">{todayCompleted.length} completed today</p>
            {todayCompleted.length > 0 && (
              <p className="text-[11px] text-muted-foreground/70 line-clamp-1">
                {todayCompleted.slice(0, 3).map(t => t.title).join(", ")}
                {todayCompleted.length > 3 && ` +${todayCompleted.length - 3} more`}
              </p>
            )}
          </div>
        </div>

        {/* Incomplete tasks */}
        {incomplete.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{incomplete.length} unfinished — what should happen to them?</p>
              <div className="flex gap-1">
                <button onClick={() => setAll("defer")} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                  all →tmrw
                </button>
                <button onClick={() => setAll("inbox")} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
                  all →inbox
                </button>
              </div>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {incomplete.map((task) => {
                const d = dispositions[task.id] ?? "keep";
                return (
                  <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="flex-1 text-xs truncate">{task.title}</span>
                    {/* Disposition buttons */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setDispositions((prev) => ({ ...prev, [task.id]: "defer" }))}
                        title="Defer to tomorrow"
                        className={cn(
                          "h-6 w-6 rounded flex items-center justify-center transition-colors",
                          d === "defer" ? "bg-sky-500/20 text-sky-400" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <MoveRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDispositions((prev) => ({ ...prev, [task.id]: "inbox" }))}
                        title="Back to inbox"
                        className={cn(
                          "h-6 w-6 rounded flex items-center justify-center transition-colors",
                          d === "inbox" ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Inbox className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {(deferCount > 0 || inboxCount > 0) && (
              <p className="text-[11px] text-muted-foreground/60">
                {deferCount > 0 && <>{deferCount} deferred to tomorrow</>}
                {deferCount > 0 && inboxCount > 0 && " · "}
                {inboxCount > 0 && <>{inboxCount} back to inbox</>}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button size="sm" className="h-8 text-xs" onClick={finishDay} disabled={applying}>
            {applying ? "Finishing…" : "Finish day ✓"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
