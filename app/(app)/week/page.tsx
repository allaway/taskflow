"use client";
import { useEffect, useState } from "react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

const priorityDot: Record<string, string> = {
  HIGH:   "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW:    "bg-slate-500",
};

const statusDot: Record<string, string> = {
  INBOX:     "bg-muted-foreground/40",
  SCHEDULED: "bg-sky-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-muted-foreground/20",
};

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    let active = true;
    setLoading(true);
    const currentDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    Promise.all(
      currentDays.map(async (day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const res = await fetch(`/api/tasks?date=${dateStr}`);
        return [dateStr, res.ok ? await res.json() : []] as [string, Task[]];
      })
    ).then((entries) => {
      if (!active) return;
      setTasksByDate(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => { active = false; };
  }, [weekStart, refresh]);

  function fetchWeekTasks() { setRefresh((r) => r + 1); }

  async function toggleComplete(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "COMPLETED" ? "SCHEDULED" : "COMPLETED";
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) await fetchWeekTasks();
    else toast.error("Failed to update task");
  }

  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") === format(weekStart, "yyyy-MM-dd");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 h-14 border-b border-border/60 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="px-1">
          <span className="text-sm font-semibold">
            {format(weekStart, "MMM d")}
            <span className="text-muted-foreground font-normal"> — </span>
            {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!thisWeek && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground ml-1"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            This week
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-h-0 divide-x divide-border/40">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateStr] ?? [];
            const completed = dayTasks.filter((t) => t.status === "COMPLETED").length;
            const today = isToday(day);

            return (
              <div key={dateStr} className={cn("flex flex-col min-h-0", today && "bg-primary/[0.03]")}>
                {/* Day header */}
                <div className={cn(
                  "px-2 py-3 border-b border-border/40 text-center shrink-0",
                )}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium mb-1">
                    {format(day, "EEE")}
                  </p>
                  <Link href={`/today?date=${dateStr}`}>
                    <div className={cn(
                      "inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold transition-colors mx-auto",
                      today
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    )}>
                      {format(day, "d")}
                    </div>
                  </Link>
                  {dayTasks.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {completed}/{dayTasks.length}
                    </p>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {loading ? (
                    <div className="h-6 rounded bg-muted/40 animate-pulse mx-1" />
                  ) : (
                    dayTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleComplete(task.id, task.status)}
                        className="w-full text-left group"
                      >
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
                          "hover:bg-white/[0.04]",
                          task.status === "COMPLETED" && "opacity-40"
                        )}>
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            task.status === "COMPLETED"
                              ? statusDot.COMPLETED
                              : priorityDot[task.priority]
                          )} />
                          <span className={cn(
                            "truncate text-[11px] leading-relaxed",
                            task.status === "COMPLETED" && "line-through"
                          )}>
                            {task.title}
                          </span>
                          {task.startTime && (
                            <span className="ml-auto text-[9px] text-muted-foreground/50 shrink-0 tabular-nums">
                              {task.startTime.slice(0, 5)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
