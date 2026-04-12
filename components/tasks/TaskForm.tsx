"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { Task } from "@prisma/client";

interface TaskFormProps {
  onSubmit: (data: Partial<Task>) => Promise<void>;
  onCancel?: () => void;
  defaultDate?: string;
  defaultTime?: string;
  compact?: boolean;
}

export function TaskForm({ onSubmit, onCancel, defaultDate, defaultTime, compact }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [duration, setDuration] = useState("");
  const [expanded, setExpanded] = useState(!compact);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      duration: duration ? parseInt(duration) : undefined,
      scheduledDate: defaultDate ? new Date(defaultDate).toISOString() : undefined,
      startTime: defaultTime || undefined,
    } as Partial<Task>);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDuration("");
    setExpanded(compact ? false : true);
    setLoading(false);
  }

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2 rounded-lg border border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/60 transition-all duration-150"
        data-testid="add-task-btn"
      >
        <Plus className="h-4 w-4" />
        Add task
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border/60 rounded-lg p-3 space-y-2.5 bg-card shadow-sm"
      data-testid="task-form"
    >
      <Input
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        className="bg-transparent border-0 border-b border-border/60 rounded-none px-0 h-8 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:border-primary/60"
        data-testid="task-title-input"
      />

      {!compact && (
        <Textarea
          placeholder="Add a description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none text-sm bg-transparent border-border/40 focus-visible:ring-0 focus-visible:border-primary/60"
        />
      )}

      <div className="flex items-center gap-2">
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="h-7 text-xs flex-1 bg-transparent border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HIGH">High priority</SelectItem>
            <SelectItem value="MEDIUM">Medium priority</SelectItem>
            <SelectItem value="LOW">Low priority</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
          className="h-7 text-xs w-16 bg-transparent border-border/40 focus-visible:ring-0"
          title="Duration in minutes"
        />

        <div className="flex gap-1 shrink-0">
          {(onCancel || compact) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => { onCancel?.(); setExpanded(false); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={loading || !title.trim()}
            data-testid="task-submit-btn"
          >
            {loading ? "…" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
