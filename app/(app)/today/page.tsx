"use client";
import { useEffect, useState } from "react";
import { format, addDays, subDays, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wand2, Plus } from "lucide-react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ScheduleModal } from "@/components/ai/ScheduleModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import type { Task } from "@prisma/client";

const HOUR_HEIGHT = 64;
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function TodayPage() {
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const dateStr = format(date, "yyyy-MM-dd");

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
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task deleted");
    } else {
      toast.error("Failed to delete task");
    }
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
    const updates = schedule.map((s) =>
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
    );
    await Promise.all(updates);
    await fetchTasks();
    toast.success("Schedule applied");
  }

  const scheduledTasks = tasks.filter((t) => t.startTime);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setDate((d) => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{format(date, "EEEE")}</h1>
              <p className="text-xs text-muted-foreground">{format(date, "MMMM d, yyyy")}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDate((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setDate(new Date())}
            >
              Today
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScheduleOpen(true)}
            data-testid="plan-my-day-btn"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Plan my day
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <ScrollArea className="flex-1">
            <div className="relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="absolute -top-2.5 left-4 text-[10px] text-muted-foreground w-8">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {!loading && scheduledTasks.map((task) => {
                if (!task.startTime) return null;
                const startMins = timeToMinutes(task.startTime) - START_HOUR * 60;
                const height = ((task.duration ?? 30) / 60) * HOUR_HEIGHT;
                const top = (startMins / 60) * HOUR_HEIGHT;

                return (
                  <div
                    key={task.id}
                    className="absolute left-14 right-4"
                    style={{ top: `${top}px`, height: `${Math.max(height, 32)}px` }}
                  >
                    <TaskCard task={task} onUpdate={updateTask} onDelete={deleteTask} showTime />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DndContext>
      </div>

      <div className="w-72 border-l border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium">Inbox</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddingTask(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {addingTask && (
              <TaskForm onSubmit={addTask} onCancel={() => setAddingTask(false)} defaultDate={dateStr} />
            )}
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)
            ) : inboxTasks.length === 0 && !addingTask ? (
              <p className="text-xs text-muted-foreground text-center py-6">No inbox tasks</p>
            ) : (
              inboxTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                />
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
