"use client";
import { useEffect, useState } from "react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import type { CalendarEvent, CalendarEventsResponse } from "@/app/api/calendar/events/route";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";

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

function DraggableWeekTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} className={isDragging ? "invisible" : undefined} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function DroppableDay({ dateStr, children, className }: { dateStr: string; children: React.ReactNode; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/[0.05] ring-1 ring-inset ring-primary/30")}>
      {children}
    </div>
  );
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    let active = true;
    setLoading(true);
    const currentDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const startStr = format(currentDays[0], "yyyy-MM-dd");
    const endStr   = format(currentDays[6], "yyyy-MM-dd");

    Promise.all([
      Promise.all(
        currentDays.map(async (day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const res = await fetch(`/api/tasks?date=${dateStr}`);
          return [dateStr, res.ok ? await res.json() : []] as [string, Task[]];
        })
      ),
      fetch(`/api/calendar/events?start=${startStr}&end=${endStr}`)
        .then((r) => r.ok ? r.json() : { events: [], feedErrors: [] })
        .then((data: CalendarEventsResponse) => {
          if (data.feedErrors?.length) {
            console.warn("[calendar] Feed errors:", data.feedErrors);
          }
          const grouped: Record<string, CalendarEvent[]> = {};
          for (const event of data.events) {
            const d = format(new Date(event.start), "yyyy-MM-dd");
            (grouped[d] ??= []).push(event);
          }
          return grouped;
        }),
    ]).then(([taskEntries, eventsGrouped]) => {
      if (!active) return;
      setTasksByDate(Object.fromEntries(taskEntries));
      setEventsByDate(eventsGrouped);
      setLoading(false);
    });
    return () => { active = false; };
  }, [weekStart, refresh]);

  function fetchWeekTasks() { setRefresh((r) => r + 1); }

  function openTask(task: Task) {
    setSelectedTask(task);
    setEditOpen(true);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTaskId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTaskId(null);
    if (!over) return;
    const taskId = active.id as string;
    const targetDate = over.id as string;
    // Find the task across all days
    const task = Object.values(tasksByDate).flat().find((t) => t.id === taskId);
    if (!task) return;
    const currentDate = task.scheduledDate ? format(new Date(task.scheduledDate), "yyyy-MM-dd") : null;
    if (currentDate === targetDate) return; // no-op
    await updateTask(taskId, {
      scheduledDate: startOfDay(new Date(targetDate)).toISOString() as unknown as Date,
      status: "SCHEDULED",
    });
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) await fetchWeekTasks();
    else toast.error("Failed to update task");
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) await fetchWeekTasks();
    else toast.error("Failed to delete task");
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-h-0 divide-x divide-border/40">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[dateStr] ?? [];
            const dayEvents = eventsByDate[dateStr] ?? [];
            const completed = dayTasks.filter((t) => t.status === "COMPLETED").length;
            const today = isToday(day);

            return (
              <DroppableDay key={dateStr} dateStr={dateStr} className={cn("flex flex-col min-h-0", today && "bg-primary/[0.03]")}>
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

                {/* Tasks + Events */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {/* Calendar events */}
                  {!loading && dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border-l-2"
                      style={{
                        backgroundColor: event.color + "18",
                        borderColor: event.color,
                      }}
                      title={`${event.title} · ${event.calendarName}`}
                    >
                      <span className="truncate text-[11px] leading-relaxed font-medium" style={{ color: event.color }}>
                        {event.allDay ? "·" : format(new Date(event.start), "h:mm")} {event.title}
                      </span>
                    </div>
                  ))}
                  {loading ? (
                    <div className="h-6 rounded bg-muted/40 animate-pulse mx-1" />
                  ) : (
                    dayTasks.map((task) => (
                      <DraggableWeekTask key={task.id} id={task.id}>
                      <button
                        onClick={() => openTask(task)}
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
                      </DraggableWeekTask>
                    ))
                  )}
                </div>
              </DroppableDay>
            );
          })}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeTaskId && (() => {
          const task = Object.values(tasksByDate).flat().find(t => t.id === activeTaskId);
          if (!task) return null;
          return (
            <div className="opacity-90 shadow-xl rotate-1 bg-card border border-border/60 rounded-lg px-3 py-2 text-xs font-medium w-36 truncate">
              {task.title}
            </div>
          );
        })()}
      </DragOverlay>
      </DndContext>

      <TaskEditModal
        task={selectedTask}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />
    </div>
  );
}
