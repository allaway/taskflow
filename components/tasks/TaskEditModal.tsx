"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";

interface LabelEntry { name: string; color: string; }

const LABEL_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#64748b",
];

interface TaskEditModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskEditModal({ task, open, onOpenChange, onUpdate, onDelete }: TaskEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [status, setStatus] = useState<"INBOX" | "SCHEDULED" | "COMPLETED" | "CANCELLED">("INBOX");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [labelPalette, setLabelPalette] = useState<LabelEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/labels").then(r => r.ok ? r.json() : []).then(setLabelPalette);
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setNotes(task.notes ?? "");
      setPriority(task.priority as "LOW" | "MEDIUM" | "HIGH");
      setStatus(task.status as "INBOX" | "SCHEDULED" | "COMPLETED" | "CANCELLED");
      // Slice the ISO string directly to avoid UTC→local timezone shift
      setScheduledDate(task.scheduledDate ? String(task.scheduledDate).slice(0, 10) : "");
      setStartTime(task.startTime ?? "");
      setDuration(task.duration?.toString() ?? "");
      try {
        const raw = (task as Task & { labels?: string }).labels;
        const parsed = raw ? JSON.parse(raw) : [];
        setLabels(Array.isArray(parsed) ? parsed : []);
      } catch { setLabels([]); }
    }
  }, [task]);

  if (!task) return null;

  const done = status === "COMPLETED";

  async function toggleComplete() {
    const newStatus = done ? (task!.scheduledDate ? "SCHEDULED" : "INBOX") : "COMPLETED";
    setStatus(newStatus);
    await onUpdate(task!.id, { status: newStatus });
    onOpenChange(false);
  }

  function addLabel(name: string) {
    const trimmed = name.trim();
    if (!trimmed || labels.includes(trimmed)) return;
    setLabels((prev) => [...prev, trimmed]);
    setLabelInput("");
    // Add to palette if new
    if (!labelPalette.find((l) => l.name === trimmed)) {
      const color = LABEL_COLORS[labelPalette.length % LABEL_COLORS.length];
      const updated = [...labelPalette, { name: trimmed, color }];
      setLabelPalette(updated);
      fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelPalette: updated }),
      });
    }
  }

  function removeLabel(name: string) {
    setLabels((prev) => prev.filter((l) => l !== name));
  }

  function getLabelColor(name: string): string {
    return labelPalette.find((l) => l.name === name)?.color ?? "#6366f1";
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
      priority,
      status,
      startTime: startTime || null,
      duration: duration ? parseInt(duration) : null,
    };
    if (scheduledDate) {
      updates.scheduledDate = new Date(scheduledDate).toISOString();
    } else {
      updates.scheduledDate = null;
      // If removing the date, also clear time and drop to inbox unless completed
      updates.startTime = null;
      if (status === "SCHEDULED") updates.status = "INBOX";
    }
    (updates as Record<string, unknown>).labels = labels.length > 0 ? labels : null;
    await onUpdate(task!.id, updates as Partial<Task>);
    setSaving(false);
    onOpenChange(false);
  }

  async function handleDelete() {
    await onDelete(task!.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            {/* Complete toggle */}
            <button
              onClick={toggleComplete}
              className={cn(
                "mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 transition-all flex items-center justify-center",
                done
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary/70"
              )}
              title={done ? "Mark incomplete" : "Mark complete"}
            >
              {done && (
                <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "flex-1 bg-transparent text-base font-semibold outline-none border-b border-transparent",
                "focus:border-border/60 transition-colors placeholder:text-muted-foreground/40",
                done && "line-through text-muted-foreground"
              )}
              placeholder="Task title"
            />
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Priority + Status */}
          <div className="flex gap-2">
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

            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="h-7 text-xs flex-1 bg-transparent border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INBOX">Inbox</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedule row */}
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                if (e.target.value && status === "INBOX") setStatus("SCHEDULED");
              }}
              className="h-7 text-xs bg-transparent border-border/40 focus-visible:ring-0 flex-1"
            />
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-7 text-xs bg-transparent border-border/40 focus-visible:ring-0 w-28"
            />
            <div className="relative w-20">
              <Input
                placeholder="min"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                className="h-7 text-xs bg-transparent border-border/40 focus-visible:ring-0 pr-7"
                title="Duration in minutes"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">
                min
              </span>
            </div>
          </div>

          {/* Labels */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Labels
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border"
                  style={{ backgroundColor: getLabelColor(label) + "22", borderColor: getLabelColor(label) + "55", color: getLabelColor(label) }}
                >
                  {label}
                  <button onClick={() => removeLabel(label)} className="hover:opacity-70 transition-opacity">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            {/* Label input with autocomplete */}
            <div className="relative">
              <Input
                placeholder="Add label…"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addLabel(labelInput); }
                  if (e.key === "," ) { e.preventDefault(); addLabel(labelInput); }
                }}
                className="h-7 text-xs bg-transparent border-border/40 focus-visible:ring-0"
              />
              {/* Palette suggestions */}
              {labelInput && labelPalette.filter(l => l.name.toLowerCase().includes(labelInput.toLowerCase()) && !labels.includes(l.name)).length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-lg shadow-lg z-50 py-1 max-h-32 overflow-y-auto">
                  {labelPalette
                    .filter(l => l.name.toLowerCase().includes(labelInput.toLowerCase()) && !labels.includes(l.name))
                    .map(l => (
                      <button
                        key={l.name}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2"
                        onClick={() => addLabel(l.name)}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
            <Textarea
              placeholder="Add a description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none text-sm bg-transparent border-border/40 focus-visible:ring-0 focus-visible:border-primary/60"
            />
          </div>

          {/* Notes */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
            <Textarea
              placeholder="Add notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm bg-transparent border-border/40 focus-visible:ring-0 focus-visible:border-primary/60"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={saving || !title.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
