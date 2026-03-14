"use client";
import { useEffect, useState } from "react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [refresh, setRefresh] = useState(0);

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

  const statusColor = {
    INBOX: "bg-muted",
    SCHEDULED: "bg-blue-500",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-muted-foreground",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">
            {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </h1>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            This week
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-h-0 divide-x divide-border">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateStr] ?? [];
            const completed = dayTasks.filter((t) => t.status === "COMPLETED").length;

            return (
              <div key={dateStr} className="flex flex-col min-h-0">
                <div
                  className={cn(
                    "px-3 py-2 border-b border-border text-center shrink-0",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                  <Link href={`/today?date=${dateStr}`}>
                    <p
                      className={cn(
                        "text-sm font-semibold hover:text-primary transition-colors",
                        isToday(day) && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </p>
                  </Link>
                  {dayTasks.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {completed}/{dayTasks.length} done
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {loading ? (
                    <div className="h-8 rounded bg-muted animate-pulse" />
                  ) : (
                    dayTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleComplete(task.id, task.status)}
                        className="w-full text-left"
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1.5 p-1.5 rounded text-xs hover:bg-accent transition-colors group",
                            task.status === "COMPLETED" && "opacity-50"
                          )}
                        >
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              statusColor[task.status]
                            )}
                          />
                          <span
                            className={cn(
                              "truncate",
                              task.status === "COMPLETED" && "line-through"
                            )}
                          >
                            {task.title}
                          </span>
                          {task.startTime && (
                            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 shrink-0">
                              {task.startTime}
                            </Badge>
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
