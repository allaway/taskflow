"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Wand2, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";
import { GeneratePromptModal } from "@/components/ai/GeneratePromptModal";
import { toast } from "sonner";

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showTime?: boolean;
  dragging?: boolean;
}

const priorityAccent = {
  HIGH:   "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW:    "bg-slate-600",
};

const sourceLabel = {
  N8N:       { text: "N8N",       cls: "text-violet-400 bg-violet-500/10" },
  RECURRING: { text: "recurring", cls: "text-sky-400 bg-sky-500/10" },
  MANUAL:    null,
};

export function TaskCard({ task, onUpdate, onDelete, showTime, dragging }: TaskCardProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const done = task.status === "COMPLETED";

  async function toggleComplete() {
    await onUpdate(task.id, { status: done ? "INBOX" : "COMPLETED" });
  }

  async function sendToN8N() {
    const res = await fetch(`/api/tasks/${task.id}/send-n8n`, { method: "POST" });
    if (res.ok) toast.success("Sent to N8N workflow");
    else { const d = await res.json(); toast.error(d.error ?? "Failed to send to N8N"); }
  }

  const src = sourceLabel[task.source];

  return (
    <>
      <div
        className={cn(
          "group relative flex items-start gap-3 px-3 py-2.5 rounded-lg",
          "bg-card border border-border/60",
          "transition-all duration-150",
          done    ? "opacity-50" : "hover:border-border hover:bg-white/[0.03]",
          dragging && "shadow-2xl rotate-1 ring-1 ring-primary/60 scale-[1.02]"
        )}
        data-testid="task-card"
        data-task-id={task.id}
      >
        {/* Priority accent line */}
        <div className={cn("absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full", priorityAccent[task.priority])} />

        {/* Checkbox */}
        <button
          onClick={toggleComplete}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border transition-all duration-150 flex items-center justify-center",
            done
              ? "bg-primary border-primary"
              : "border-border hover:border-primary/70"
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
        <div className="flex-1 min-w-0">
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
                  {task.duration && <span className="text-muted-foreground/60">· {task.duration}m</span>}
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
              <DropdownMenuItem onClick={sendToN8N}>
                <Send className="h-3.5 w-3.5 mr-2 opacity-60" />
                Send to N8N
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
    </>
  );
}
