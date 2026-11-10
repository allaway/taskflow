"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";
import { format } from "date-fns";
import { TaskEditModal } from "./TaskEditModal";
import { toast } from "sonner";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityDot: Record<string, string> = {
  HIGH:   "bg-rose-400",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-slate-300",
};

const statusBadge: Record<string, string> = {
  COMPLETED: "text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200",
  INBOX:     "text-violet-600 bg-violet-50 ring-1 ring-violet-200",
  SCHEDULED: "text-sky-600 bg-sky-50 ring-1 ring-sky-200",
  CANCELLED: "text-slate-500 bg-slate-100 ring-1 ring-slate-200",
};

const statusText: Record<string, string> = {
  COMPLETED: "Done",
  INBOX:     "Inbox",
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
};

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/tasks?q=${encodeURIComponent(q.trim())}`)
      .then((r) => r.ok ? r.json() : [])
      .then((tasks: Task[]) => { setResults(tasks); setLoading(false); setActiveIndex(0); })
      .catch(() => setLoading(false));
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  }

  function openTask(task: Task) {
    setSelectedTask(task);
    onOpenChange(false);
    setTimeout(() => setTaskModalOpen(true), 60);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      openTask(results[activeIndex]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) toast.error("Failed to update task");
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) { setTaskModalOpen(false); toast.success("Task deleted"); }
    else toast.error("Failed to delete task");
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <div
            className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Search tasks by title, description, or notes…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/35"
              />
              {query ? (
                <button
                  onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="text-[11px] text-muted-foreground/30 font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">esc</kbd>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[52vh] overflow-y-auto">
              {loading && (
                <div className="py-10 text-center text-xs text-muted-foreground/40">Searching…</div>
              )}
              {!loading && !query && (
                <div className="py-10 text-center text-xs text-muted-foreground/40">
                  Type to search across all tasks
                </div>
              )}
              {!loading && query && results.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground/40">
                  No tasks found for &ldquo;{query}&rdquo;
                </div>
              )}
              {results.map((task, i) => {
                let labels: string[] = [];
                try {
                  const raw = (task as Task & { labels?: string }).labels;
                  labels = raw ? JSON.parse(raw) : [];
                } catch { /* ignore */ }

                return (
                  <button
                    key={task.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      i === activeIndex ? "bg-muted/60" : "hover:bg-muted/40"
                    )}
                    onClick={() => openTask(task)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <div className={cn("h-2 w-2 rounded-full shrink-0 mt-px", priorityDot[task.priority])} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        task.status === "COMPLETED" && "line-through text-muted-foreground"
                      )}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground/50 truncate mt-0.5 leading-relaxed">
                          {task.description.replace(/[#*`_~>\[\]]/g, "").slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {labels.slice(0, 2).map((l) => (
                        <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary font-medium ring-1 ring-primary/15">
                          {l}
                        </span>
                      ))}
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", statusBadge[task.status])}>
                        {statusText[task.status]}
                      </span>
                      {task.scheduledDate && (
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                          {format(new Date(task.scheduledDate), "MMM d")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground/35">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> open</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
                <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <TaskEditModal
        task={selectedTask}
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />
    </>
  );
}
