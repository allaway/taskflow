"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/40 transition-colors"
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
      className="border rounded-lg p-3 space-y-2.5 bg-card"
      data-testid="task-form"
    >
      <Input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        data-testid="task-title-input"
      />
      {!compact && (
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">High priority</SelectItem>
              <SelectItem value="MEDIUM">Medium priority</SelectItem>
              <SelectItem value="LOW">Low priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-24">
          <Input
            placeholder="30m"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
            className="h-8 text-xs"
          />
          <Label className="text-[10px] text-muted-foreground">Duration (min)</Label>
        </div>
        <div className="flex gap-1">
          {onCancel && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onCancel(); setExpanded(false); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" size="sm" disabled={loading || !title.trim()} data-testid="task-submit-btn">
            {loading ? "…" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
