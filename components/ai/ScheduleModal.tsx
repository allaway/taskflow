"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

interface ScheduleEntry {
  taskId: string;
  startTime: string;
  duration: number;
}

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  tasks: Task[];
  onAccept: (schedule: ScheduleEntry[]) => Promise<void>;
}

export function ScheduleModal({ open, onOpenChange, date, tasks, onAccept }: ScheduleModalProps) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [generated, setGenerated] = useState(false);

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

  async function generate() {
    setLoading(true);
    setGenerated(false);
    const res = await fetch("/api/ai/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: format(date, "yyyy-MM-dd") }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to generate schedule");
      return;
    }
    setSchedule(data.schedule);
    setGenerated(true);
  }

  async function handleAccept() {
    setAccepting(true);
    await onAccept(schedule);
    setAccepting(false);
    onOpenChange(false);
    setGenerated(false);
    setSchedule([]);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setGenerated(false);
      setSchedule([]);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            AI Schedule — {format(date, "EEEE, MMM d")}
          </DialogTitle>
          <DialogDescription>
            {tasks.filter((t) => t.status === "INBOX").length} inbox task{tasks.filter((t) => t.status === "INBOX").length !== 1 ? "s" : ""} to schedule
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center">
              AI will suggest time slots for all your inbox tasks based on priority and duration.
            </p>
            <Button onClick={generate} disabled={loading} data-testid="ai-schedule-btn">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating schedule…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Schedule
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {schedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tasks to schedule.</p>
            ) : (
              schedule.map((entry) => {
                const task = taskMap[entry.taskId];
                if (!task) return null;
                return (
                  <div key={entry.taskId} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                    <span className="text-sm font-mono text-muted-foreground w-12 shrink-0">{entry.startTime}</span>
                    <span className="flex-1 text-sm font-medium truncate">{task.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{entry.duration}m</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {generated && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={generate} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerate"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Discard
            </Button>
            <Button onClick={handleAccept} disabled={accepting || schedule.length === 0} data-testid="accept-schedule-btn">
              {accepting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Apply Schedule
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
