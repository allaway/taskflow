"use client";
import { useEffect, useState, useRef } from "react";
import { format, addDays, subDays, startOfDay, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wand2, Plus, Sunrise, Moon } from "lucide-react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ScheduleModal } from "@/components/ai/ScheduleModal";
import { PlanningModal } from "@/components/tasks/PlanningModal";
import { ShutdownModal } from "@/components/tasks/ShutdownModal";
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
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import type { Task } from "@prisma/client";
import type { CalendarEvent } from "@/app/api/calendar/events/route";
import { fetchCalendarEvents, loadCalendarFeeds } from "@/lib/calendarClient";

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 23;
const SLOT_MINUTES = 15;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const TOTAL_SLOTS = ((END_HOUR - START_HOUR + 1) * 60) / SLOT_MINUTES;

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

// ─── Draggable task wrapper ───────────────────────────────────────────────────
function DraggableTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "invisible" : undefined}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

// ─── Droppable 15-min time slot ───────────────────────────────────────────────
function DroppableTimeSlot({ slotMins, slotIndex }: { slotMins: number; slotIndex: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: slotMins });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute left-14 right-0 pointer-events-none transition-colors",
        isOver && "!pointer-events-auto bg-primary/15 rounded"
      )}
      style={{
        top: `${(slotIndex * SLOT_MINUTES / 60) * HOUR_HEIGHT}px`,
        height: `${(SLOT_MINUTES / 60) * HOUR_HEIGHT}px`,
        zIndex: 1,
      }}
    />
  );
}

// ─── Droppable inbox zone ─────────────────────────────────────────────────────
function DroppableInbox({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "inbox" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "transition-colors",
        isOver && "bg-primary/[0.04] ring-1 ring-inset ring-primary/25"
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Resizable task block ─────────────────────────────────────────────────────
function ResizableTaskBlock({
  task,
  top,
  height,
  onResize,
  children,
}: {
  task: Task;
  top: number;
  height: number;
  onResize: (newDuration: number) => void;
  children: React.ReactNode;
}) {
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const startY = useRef<number>(0);
  const startDuration = useRef<number>(0);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startDuration.current = task.duration ?? 30;

    function onMove(ev: PointerEvent) {
      const deltaY = ev.clientY - startY.current;
      const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / SLOT_MINUTES) * SLOT_MINUTES;
      const newDuration = Math.max(SLOT_MINUTES, startDuration.current + deltaMins);
      setLiveHeight((newDuration / 60) * HOUR_HEIGHT);
    }
    function onUp(ev: PointerEvent) {
      const deltaY = ev.clientY - startY.current;
      const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / SLOT_MINUTES) * SLOT_MINUTES;
      const newDuration = Math.max(SLOT_MINUTES, startDuration.current + deltaMins);
      setLiveHeight(null);
      onResize(newDuration);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const displayHeight = liveHeight ?? height;

  return (
    <div
      className="absolute left-14 right-4"
      style={{ top: `${top}px`, height: `${Math.max(displayHeight, 36)}px`, zIndex: 10 }}
    >
      {children}
      {/* Resize handle */}
      <div
        onPointerDown={onPointerDown}
        className="absolute bottom-0 left-0 right-0 h-2.5 flex items-center justify-center cursor-ns-resize group/resize z-20"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 rounded-full bg-border/60 group-hover/resize:bg-primary/60 transition-colors" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [dailyBudgetHours, setDailyBudgetHours] = useState(8);
  const [refresh, setRefresh] = useState(0);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const timelineRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const dateStr = format(date, "yyyy-MM-dd");
  const todayView = isToday(date);

  // Advance overdue tasks once per calendar day
  useEffect(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const storageKey = "taskflow_last_advanced";
    if (typeof window !== "undefined" && localStorage.getItem(storageKey) !== todayKey) {
      fetch("/api/tasks/advance-overdue", { method: "POST" }).then((r) => {
        if (r.ok) {
          localStorage.setItem(storageKey, todayKey);
          setRefresh((r) => r + 1);
        }
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    Promise.all([
      fetch(`/api/tasks?date=${dateStr}`),
      fetch("/api/tasks?status=INBOX"),
      fetch(`/api/tasks?completedDate=${todayStr}`),
    ]).then(async ([dayRes, inboxRes, completedRes]) => {
      if (!active) return;
      if (dayRes.ok) setTasks(await dayRes.json());
      if (inboxRes.ok) setInboxTasks(await inboxRes.json());
      if (completedRes.ok) setCompletedToday(await completedRes.json());
      setLoading(false);
    });

    // Calendar: fetch from browser so the user's IP downloads the iCal
    // (cloud server IPs are blocked by Google Calendar)
    loadCalendarFeeds().then((feeds) =>
      fetchCalendarEvents(feeds, dateStr, dateStr)
    ).then(({ events, feedErrors }) => {
      if (!active) return;
      setCalendarEvents(events);
      if (feedErrors.length) console.warn("[calendar] Feed errors:", feedErrors);
    }).catch((err) => console.warn("[calendar]", err));
    return () => { active = false; };
  }, [dateStr, refresh]);

  useEffect(() => {
    fetch("/api/user/settings").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.dailyBudgetHours) setDailyBudgetHours(d.dailyBudgetHours);
    });
  }, []);

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

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTaskId(active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;

    const taskId = active.id as string;

    if (over.id === "inbox") {
      // Unschedule: move back to global inbox
      await updateTask(taskId, {
        scheduledDate: null as unknown as Date,
        startTime: null,
        status: "INBOX",
      });
      toast.success("Moved to inbox");
    } else {
      // Schedule to a time slot
      const slotMins = over.id as number;
      const hour = Math.floor(slotMins / 60);
      const minute = slotMins % 60;
      const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      await updateTask(taskId, {
        scheduledDate: startOfDay(date).toISOString() as unknown as Date,
        startTime,
        status: "SCHEDULED",
      });
      toast.success("Task scheduled");
    }
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
  const unscheduledDayTasks = tasks.filter((t) => !t.startTime);
  const allTasks = [...tasks, ...inboxTasks];
  const activeTask = activeTaskId ? allTasks.find((t) => t.id === activeTaskId) ?? null : null;

  const plannedMinutes = scheduledTasks.reduce((acc, t) => acc + (t.duration ?? 30), 0);
  const budgetMinutes = dailyBudgetHours * 60;
  const plannedH = Math.floor(plannedMinutes / 60);
  const plannedM = plannedMinutes % 60;
  const plannedLabel = plannedH > 0
    ? `${plannedH}h${plannedM > 0 ? ` ${plannedM}m` : ""}`
    : `${plannedM}m`;
  const budgetPct = Math.min((plannedMinutes / budgetMinutes) * 100, 100);
  const budgetColor = plannedMinutes > budgetMinutes
    ? "text-rose-400"
    : plannedMinutes > budgetMinutes * 0.85
    ? "text-amber-400"
    : "text-emerald-400";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-hidden">
        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0 gap-3">
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
            {/* Daily budget indicator */}
            {!loading && plannedMinutes > 0 && (
              <div className="flex items-center gap-2 ml-auto mr-2">
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn("text-[11px] font-medium tabular-nums", budgetColor)}>
                    {plannedLabel} <span className="text-muted-foreground/50 font-normal">of {dailyBudgetHours}h</span>
                  </span>
                  <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", plannedMinutes > budgetMinutes ? "bg-rose-500" : plannedMinutes > budgetMinutes * 0.85 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                onClick={() => setPlanningOpen(true)}
                title="Start day — plan what you'll work on"
              >
                <Sunrise className="h-3.5 w-3.5" />
                Start day
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-border/60 bg-transparent hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                onClick={() => setScheduleOpen(true)}
                data-testid="plan-my-day-btn"
              >
                <Wand2 className="h-3.5 w-3.5" />
                AI schedule
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                onClick={() => setShutdownOpen(true)}
                title="Finish day — review and defer incomplete tasks"
              >
                <Moon className="h-3.5 w-3.5" />
                Finish day
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div
              ref={timelineRef}
              className="relative"
              style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}
            >
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

              {/* Half-hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={`${hour}-half`}
                  className="absolute left-14 right-0 border-t border-border/15"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* Droppable 15-min time slots */}
              {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                <DroppableTimeSlot
                  key={i}
                  slotMins={START_HOUR * 60 + i * SLOT_MINUTES}
                  slotIndex={i}
                />
              ))}

              {/* Now indicator */}
              {nowPx !== null && (
                <div className="absolute left-14 right-0 z-20 pointer-events-none" style={{ top: `${nowPx}px` }}>
                  <div className="relative flex items-center">
                    <div className="h-2 w-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-rose-500" />
                  </div>
                </div>
              )}

              {/* Google Calendar events (read-only) */}
              {!loading && calendarEvents.map((event) => {
                if (event.allDay) return null;
                const eventStart = new Date(event.start);
                const eventEnd   = new Date(event.end);
                const startMins  = eventStart.getHours() * 60 + eventStart.getMinutes() - START_HOUR * 60;
                const endMins    = eventEnd.getHours()   * 60 + eventEnd.getMinutes()   - START_HOUR * 60;
                const height     = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 24);
                const top        = (startMins / 60) * HOUR_HEIGHT;
                if (startMins < 0 || startMins > (END_HOUR - START_HOUR) * 60) return null;
                return (
                  <div
                    key={event.id}
                    className="absolute left-14 right-4 pointer-events-none"
                    style={{ top: `${top}px`, height: `${height}px`, zIndex: 5 }}
                  >
                    <div
                      className="h-full rounded-md px-2 py-1 overflow-hidden border-l-2 opacity-80"
                      style={{
                        backgroundColor: event.color + "22",
                        borderColor: event.color,
                      }}
                    >
                      <p className="text-[11px] font-medium leading-tight truncate" style={{ color: event.color }}>
                        {event.title}
                      </p>
                      <p className="text-[10px] opacity-70 leading-tight" style={{ color: event.color }}>
                        {format(new Date(event.start), "h:mm")}–{format(new Date(event.end), "h:mm a")}
                        {" · "}{event.calendarName}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Scheduled tasks */}
              {!loading && scheduledTasks.map((task) => {
                if (!task.startTime) return null;
                const startMins = timeToMinutes(task.startTime) - START_HOUR * 60;
                const height = ((task.duration ?? 30) / 60) * HOUR_HEIGHT;
                const top = (startMins / 60) * HOUR_HEIGHT;
                return (
                  <ResizableTaskBlock
                    key={task.id}
                    task={task}
                    top={top}
                    height={Math.max(height, 36)}
                    onResize={(newDuration) => updateTask(task.id, { duration: newDuration })}
                  >
                    <DraggableTask id={task.id}>
                      <TaskCard task={task} onUpdate={updateTask} onDelete={deleteTask} showTime />
                    </DraggableTask>
                  </ResizableTaskBlock>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* ── Inbox panel ──────────────────────────────────────────────────── */}
        <DroppableInbox
          className="border-l border-border/60 flex flex-col shrink-0"
          style={{ width: "272px" }}
        >
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
              {/* Planned-but-untimed tasks for today */}
              {!loading && unscheduledDayTasks.length > 0 && (
                <>
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide px-1 pt-1">
                    Today — drag to schedule
                  </p>
                  {unscheduledDayTasks.map((task) => (
                    <DraggableTask key={task.id} id={task.id}>
                      <TaskCard task={task} onUpdate={updateTask} onDelete={deleteTask} />
                    </DraggableTask>
                  ))}
                  {inboxTasks.length > 0 && (
                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide px-1 pt-2">
                      Inbox
                    </p>
                  )}
                </>
              )}
              {loading ? (
                [1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />)
              ) : inboxTasks.length === 0 && !addingTask && unscheduledDayTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">Inbox is clear</p>
                </div>
              ) : (
                inboxTasks.map((task) => (
                  <DraggableTask key={task.id} id={task.id}>
                    <TaskCard task={task} onUpdate={updateTask} onDelete={deleteTask} />
                  </DraggableTask>
                ))
              )}
            </div>
          </ScrollArea>
        </DroppableInbox>
      </div>

      {/* Drag overlay — floating preview while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="opacity-90 shadow-2xl rotate-1 scale-105 w-64">
            <TaskCard task={activeTask} onUpdate={async () => {}} onDelete={async () => {}} />
          </div>
        )}
      </DragOverlay>

      <ScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        date={date}
        tasks={[...tasks, ...inboxTasks]}
        onAccept={acceptSchedule}
      />
      <PlanningModal
        open={planningOpen}
        onOpenChange={setPlanningOpen}
        date={date}
        onDone={fetchTasks}
      />
      <ShutdownModal
        open={shutdownOpen}
        onOpenChange={setShutdownOpen}
        date={date}
        tasks={tasks}
        completedToday={completedToday}
        onDone={fetchTasks}
      />
    </DndContext>
  );
}
