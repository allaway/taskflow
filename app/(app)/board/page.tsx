"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { TaskCard } from "@/components/tasks/TaskCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Columns3 } from "lucide-react";
import type { Task } from "@prisma/client";
import type { TaskWithMeta } from "@/lib/types";

const COLUMNS: { status: string; title: string; accent: string }[] = [
  { status: "INBOX", title: "Inbox", accent: "bg-slate-400" },
  { status: "SCHEDULED", title: "Scheduled", accent: "bg-blue-400" },
  { status: "NEEDS_REVIEW", title: "Needs review", accent: "bg-orange-400" },
  { status: "COMPLETED", title: "Done", accent: "bg-green-400" },
];

function DraggableCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: TaskWithMeta;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(isDragging && "opacity-30")}>
      <TaskCard task={task} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  );
}

function Column({
  status,
  title,
  accent,
  tasks,
  onUpdate,
  onDelete,
}: {
  status: string;
  title: string;
  accent: string;
  tasks: TaskWithMeta[];
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[260px] flex flex-col rounded-xl bg-muted/30 border border-border/40 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 shrink-0">
        <span className={cn("h-2 w-2 rounded-full", accent)} />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground ml-auto">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function BoardPageInner() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (projectFilter) params.set("projectId", projectFilter);
    const res = await fetch(`/api/tasks?${params}`);
    if (res.ok) {
      const all: TaskWithMeta[] = await res.json();
      setTasks(all.filter((t) => t.status !== "CANCELLED" && !t.parentId));
    }
  }, [projectFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!projectFilter) {
      setProjectName(null);
      return;
    }
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((projects: { id: string; name: string }[]) => {
        setProjectName(projects.find((p) => p.id === projectFilter)?.name ?? null);
      });
  }, [projectFilter]);

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error?.toString?.() ?? "Failed to update task");
    } else {
      const data = await res.json();
      const failed = (data.linkSync ?? []).filter((s: { ok: boolean }) => !s.ok);
      for (const f of failed) {
        toast.error(`Could not resolve ${f.provider} link: ${f.error}`);
      }
      const synced = (data.linkSync ?? []).filter((s: { ok: boolean }) => s.ok);
      if (synced.length > 0) toast.success(`Resolved ${synced.length} linked issue(s)`);
    }
    fetchTasks();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  }

  function onDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const taskId = String(event.active.id);
    const target = event.over?.id ? String(event.over.id) : null;
    if (!target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === target) return;

    const updates: Record<string, unknown> = { status: target };
    if (target === "SCHEDULED" && !task.scheduledDate) {
      updates.scheduledDate = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
    }
    if (target === "INBOX") {
      updates.scheduledDate = null;
      updates.startTime = null;
    }

    // Optimistic move
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: target as Task["status"] } : t)));
    await updateTask(taskId, updates as Partial<Task>);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Columns3 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            Board{projectName ? ` — ${projectName}` : ""}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Drag tasks between columns. Dropping into Done completes the task and resolves linked issues.
        </p>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 px-6 pb-6 overflow-x-auto min-h-0">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              title={col.title}
              accent={col.accent}
              tasks={tasks.filter((t) => t.status === col.status)}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <TaskCard task={activeTask} onUpdate={async () => {}} onDelete={async () => {}} dragging />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={null}>
      <BoardPageInner />
    </Suspense>
  );
}
