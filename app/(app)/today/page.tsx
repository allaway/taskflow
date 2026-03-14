"use client";
import { useEffect, useState, useRef } from "react";
import { format, addDays, subDays, startOfDay, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wand2, Plus } from "lucide-react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ScheduleModal } from "@/components/ai/ScheduleModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import type { Task } from "@prisma/client";

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function nowTopPx(): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const startMins = START_HOUR * 60;
  const endMins = END_HOUR * 60;
  if (mins < startMins || mins > endMins) return null;
  return ((mins - startMins) / 60) * HOUR_HEIGHT;
}

export default function TodayPage() {
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const dateStr = format(date, "yyyy-MM-dd");
  const todayView = isToday(date);

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/tasks?date=${dateStr}`),
      fetch("/api/tasks?status=INBOX"),
    ]).then(async ([dayRes, inboxRes]) => {
      if (!active) return;
      if (dayRes.ok) setTasks(await dayRes.json());
      if (inboxRes.ok) setInboxTasks(await inboxRes.json());
      setLoading(false);
    });
    return () => { active = false; };
  }, [dateStr, refresh]);

  useEffect(() => {
    if (!todayView) { setNowPx(null); return; }
    setNowPx(nowTopPx());
    const id = setInterval(() => setNowPx(nowTopPx()), 60_000);
    return () => clearInterval(id);
  }, [todayView]);

  function fetchTasks() { setRefresh((r) => r + 1); }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) await fetchTasks();
    else toast.error("Failed to update task");
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) { setTasks((prev) => prev.filter((t) => t.id !== id)); toast.success("Task deleted"); }
    else toast.error("Failed to delete task");
  }

  async function addTask(data: Partial<Task>) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, scheduledDate: startOfDay(date).toISOString() }),
    });
    if (res.ok) { await fetchTasks(); setAddingTask(false); toast.success("Task added"); }
    else toast.error("Failed to add task");
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const slotMinutes = over.id as unknown as number;
    const hour = Math.floor(slotMinutes / 60);
    const minute = slotMinutes % 60;
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    await updateTask(taskId, {
      scheduledDate: startOfDay(date).toISOString() as unknown as Date,
      startTime,
      status: "SCHEDULED",
    });
    toast.success("Task scheduled");
  }

  async function acceptSchedule(schedule: { taskId: string; startTime: string; duration: number }[]) {
    await Promise.all(schedule.map((s) =>
      fetch(`/api/tasks/${s.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: startOfDay(date).toISOString(),
          startTime: s.startTime,
          duration: s.duration,
          status: "SCHEDULED",
        }),
      })
    ));
    await fetchTasks();
    toast.success("Schedule applied");
  }

  const scheduledTasks = tasks.filter((t) => t.startTime);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Timeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDate((d) => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-2">
              <div className="flex items-baseline gap-2">
                <h1 className="text-sm font-semibold">{format(date, "EEEE")}</h1>
                <span className="text-xs text-muted-foreground">{format(date, "MMM d")}</span>
                {todayView && (
                  <span className="text-[10px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                    today
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDate((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!todayView && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground ml-1" onClick={() => setDate(new Date())}>
                Today
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-border/60 bg-transparent hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
            onClick={() => setScheduleOpen(true)}
            data-testid="plan-my-day-btn"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Plan my day
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <ScrollArea className="flex-1">
            <div ref={timelineRef} className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-start"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-[10px] text-muted-foreground/50 w-14 text-right pr-3 pt-0 leading-none select-none shrink-0">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                  <div className="flex-1 border-t border-border/30 mt-0" />
                </div>
              ))}

              {/* Half-hour lines (subtle) */}
              {HOURS.map((hour) => (
                <div
                  key={`${hour}-half`}
                  className="absolute left-14 right-0 border-t border-border/15"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* Now indicator */}
              {nowPx !== null && (
                <div className="absolute left-14 right-0 z-10 pointer-events-none" style={{ top: `${nowPx}px` }}>
                  <div className="relative flex items-center">
                    <div className="h-2 w-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-rose-500" />
                  </div>
                </div>
              )}

              {/* Scheduled tasks */}
              {!loading && scheduledTasks.map((task) => {
                if (!task.startTime) return null;
                const startMins = timeToMinutes(task.startTime) - START_HOUR * 60;
                const height = ((task.duration ?? 30) / 60) * HOUR_HEIGHT;
                const top = (startMins / 60) * HOUR_HEIGHT;
                return (
                  <div
                    key={task.id}
                    className="absolute left-14 right-4"
                    style={{ top: `${top}px`, height: `${Math.max(height, 36)}px` }}
                  >
                    <TaskCard task={task} onUpdate={updateTask} onDelete={deleteTask} showTime />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DndContext>
      </div>

      {/* Inbox panel */}
      <div className="w-68 border-l border-border/60 flex flex-col shrink-0" style={{ width: "272px" }}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Inbox</span>
            {inboxTasks.length > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {inboxTasks.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", addingTask && "text-primary")}
            onClick={() => setAddingTask((v) => !v)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1.5">
            {addingTask && (
              <TaskForm onSubmit={addTask} onCancel={() => setAddingTask(false)} defaultDate={dateStr} />
            )}
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />)
            ) : inboxTasks.length === 0 && !addingTask ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">Inbox is clear</p>
              </div>
            ) : (
              inboxTasks.map((task) => (
                <TaskCard key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <ScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        date={date}
        tasks={[...tasks, ...inboxTasks]}
        onAccept={acceptSchedule}
      />
    </div>
  );
}
