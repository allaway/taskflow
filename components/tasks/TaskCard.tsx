"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Check, Trash2, Wand2, Send, Clock } from "lucide-react";
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

const priorityColors = {
  HIGH: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

const sourceColors = {
  N8N: "bg-violet-100 text-violet-700 border-violet-200",
  RECURRING: "bg-blue-100 text-blue-700 border-blue-200",
  MANUAL: "",
};

export function TaskCard({ task, onUpdate, onDelete, showTime, dragging }: TaskCardProps) {
  const [promptOpen, setPromptOpen] = useState(false);

  async function toggleComplete() {
    const newStatus = task.status === "COMPLETED" ? "INBOX" : "COMPLETED";
    await onUpdate(task.id, { status: newStatus });
  }

  async function sendToN8N() {
    const res = await fetch(`/api/tasks/${task.id}/send-n8n`, { method: "POST" });
    if (res.ok) {
      toast.success("Sent to N8N workflow");
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to send to N8N");
    }
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-start gap-2.5 p-3 rounded-lg border bg-card transition-all",
          task.status === "COMPLETED" && "opacity-60",
          dragging && "shadow-lg rotate-1 ring-2 ring-primary",
          "hover:border-primary/40 hover:shadow-sm"
        )}
        data-testid="task-card"
        data-task-id={task.id}
      >
        <button
          onClick={toggleComplete}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
            task.status === "COMPLETED"
              ? "bg-primary border-primary"
              : "border-muted-foreground/40 hover:border-primary"
          )}
          data-testid="task-complete-btn"
        >
          {task.status === "COMPLETED" && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-snug break-words",
              task.status === "COMPLETED" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {task.priority !== "MEDIUM" && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityColors[task.priority])}>
                {task.priority}
              </Badge>
            )}
            {task.source !== "MANUAL" && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sourceColors[task.source])}>
                {task.source}
              </Badge>
            )}
            {showTime && task.startTime && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {task.startTime}
                {task.duration && ` · ${task.duration}m`}
              </span>
            )}
          </div>
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Generate AI prompt"
            onClick={() => setPromptOpen(true)}
            data-testid="generate-prompt-btn"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="h-6 w-6" />}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={sendToN8N}>
                <Send className="h-3.5 w-3.5 mr-2" />
                Send to N8N
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
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
