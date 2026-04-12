"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Wand2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";
import { GeneratePromptModal } from "@/components/ai/GeneratePromptModal";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showTime?: boolean;
  dragging?: boolean;
}

const priorityAccent: Record<string, string> = {
  HIGH:   "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW:    "bg-slate-500/60",
};

const sourceLabel: Record<string, { text: string; cls: string } | null> = {
  API:       { text: "api",       cls: "text-violet-400 bg-violet-500/10" },
  RECURRING: { text: "recurring", cls: "text-sky-400 bg-sky-500/10" },
  MANUAL:    null,
};

export function TaskCard({ task, onUpdate, onDelete, showTime, dragging }: TaskCardProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const done = task.status === "COMPLETED";

  async function toggleComplete() {
    await onUpdate(task.id, { status: done ? (task.scheduledDate ? "SCHEDULED" : "INBOX") : "COMPLETED" });
  }

  const src = sourceLabel[task.source];

  return (
    <>
      <div
        className={cn(
          "group relative flex items-start gap-3 px-3 py-2.5 rounded-xl",
          "bg-card border border-border/70",
          "shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
          "transition-all duration-150",
          done
            ? "opacity-40"
            : "hover:border-border hover:shadow-[0_2px_8px_rgba(0,0,0,0.45)] hover:translate-y-[-1px]",
          dragging && "shadow-2xl rotate-1 ring-1 ring-primary/50 scale-[1.02]"
        )}
        data-testid="task-card"
        data-task-id={task.id}
      >
        {/* Priority accent line */}
        <div className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full",
          priorityAccent[task.priority]
        )} />

        {/* Checkbox */}
        <button
          onClick={toggleComplete}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] transition-all duration-150 flex items-center justify-center",
            done
              ? "bg-primary border-primary"
              : "border-border/80 hover:border-primary/70"
          )}
          data-testid="task-complete-btn"
        >
          {done && (
            <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <p className={cn(
            "text-sm leading-snug break-words",
            done ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {task.title}
          </p>

          {task.description && !done && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Label chips */}
          {(task as Task & { labels?: string | null }).labels && (() => {
            try {
              const parsed = JSON.parse((task as Task & { labels: string }).labels) as string[];
              if (!Array.isArray(parsed) || parsed.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {parsed.map((label: string) => (
                    <span key={label} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/80 font-medium">
                      {label}
                    </span>
                  ))}
                </div>
              );
            } catch { return null; }
          })()}

          {(src || (showTime && task.startTime)) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {src && (
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", src.cls)}>
                  {src.text}
                </span>
              )}
              {showTime && task.startTime && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {task.startTime}
                  {task.duration && <span className="text-muted-foreground/50">· {task.duration}m</span>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Generate AI prompt"
            onClick={() => setPromptOpen(true)}
            data-testid="generate-prompt-btn"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                />
              }
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2 opacity-60" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <GeneratePromptModal
        open={promptOpen}
        onOpenChange={setPromptOpen}
        taskId={task.id}
        taskTitle={task.title}
      />
      <TaskEditModal
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
