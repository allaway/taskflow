"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Wand2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";
import { GeneratePromptModal } from "@/components/ai/GeneratePromptModal";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const cardMdComponents: Components = {
  p: ({ children }) => <span className="block">{children}</span>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  ),
  code: ({ children }) => <code className="bg-muted/80 rounded px-0.5 text-[11px] font-mono">{children}</code>,
  ul: ({ children }) => <span className="block">{children}</span>,
  ol: ({ children }) => <span className="block">{children}</span>,
  li: ({ children }) => <span className="block pl-3 before:content-['·'] before:mr-1.5 before:opacity-50">{children}</span>,
};

interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showTime?: boolean;
  dragging?: boolean;
}

// Priority shown via checkbox ring color
const priorityRing: Record<string, string> = {
  HIGH:   "border-rose-400 hover:border-rose-400",
  MEDIUM: "border-amber-400 hover:border-amber-400",
  LOW:    "border-slate-300 hover:border-slate-400",
};

const priorityDot: Record<string, string> = {
  HIGH:   "bg-rose-400",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-slate-300",
};

const sourceLabel: Record<string, { text: string; cls: string } | null> = {
  API:       { text: "api",       cls: "text-violet-600 bg-violet-50 ring-1 ring-violet-200" },
  RECURRING: { text: "recurring", cls: "text-sky-600 bg-sky-50 ring-1 ring-sky-200" },
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

  let labels: string[] = [];
  try {
    const raw = (task as Task & { labels?: string }).labels;
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) labels = parsed;
  } catch { /* ignore */ }

  return (
    <>
      <div
        className={cn(
          "group relative flex items-start gap-2.5 px-3 py-2 rounded-xl",
          "bg-card border border-border/60",
          "shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06)]",
          "transition-all duration-150",
          done
            ? "opacity-50"
            : "hover:border-border hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.06)] hover:-translate-y-px",
          dragging && "shadow-xl rotate-1 ring-2 ring-primary/40 scale-[1.02]"
        )}
        data-testid="task-card"
        data-task-id={task.id}
      >
        {/* Checkbox */}
        <button
          onClick={toggleComplete}
          className={cn(
            "mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-all duration-150 flex items-center justify-center",
            done
              ? "bg-primary border-primary"
              : priorityRing[task.priority]
          )}
          data-testid="task-complete-btn"
        >
          {done && (
            <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <p className={cn(
            "text-[13.5px] font-medium leading-snug break-words",
            done ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {task.title}
          </p>

          {task.description && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={cardMdComponents}>
                {task.description}
              </ReactMarkdown>
            </div>
          )}

          {/* Meta row */}
          {(labels.length > 0 || src || (showTime && task.startTime)) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {labels.map((label: string) => (
                <span key={label} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary font-medium ring-1 ring-primary/15">
                  {label}
                </span>
              ))}
              {src && (
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", src.cls)}>
                  {src.text}
                </span>
              )}
              {showTime && task.startTime && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                  <Clock className="h-3 w-3" />
                  {task.startTime.slice(0, 5)}
                  {task.duration && <span className="text-muted-foreground/50">· {task.duration}m</span>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Priority dot (visible at rest, hides on hover to show actions) */}
        <div className={cn(
          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 transition-opacity duration-150",
          priorityDot[task.priority],
          "opacity-60 group-hover:opacity-0"
        )} />

        {/* Hover actions */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                  className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
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
