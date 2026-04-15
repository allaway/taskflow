"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X, Tag, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface LabelEntry { name: string; color: string; }

const LABEL_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#64748b",
];

// Markdown component overrides — safe links, readable typography
const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/40 hover:decoration-primary transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className?.startsWith("language-"));
    return isBlock
      ? <code className="text-xs font-mono">{children}</code>
      : <code className="bg-muted rounded px-1 py-0.5 text-[12px] font-mono text-foreground/80">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-muted rounded-lg px-3 py-2.5 text-xs overflow-x-auto mb-2 font-mono">{children}</pre>
  ),
  ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-0.5 mb-2 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground my-2 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border/40 my-3" />,
};

function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  editRows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  editRows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const hasContent = value.trim().length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </p>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {editing ? (
            <><Check className="h-3 w-3" /> Done</>
          ) : (
            <><Pencil className="h-3 w-3" /> Edit</>
          )}
        </button>
      </div>
      {editing ? (
        <Textarea
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={editRows}
          className="resize-none text-sm bg-transparent border-border/50 focus-visible:ring-0 focus-visible:border-primary/60 font-mono"
        />
      ) : hasContent ? (
        <div
          className="min-h-[2rem] cursor-text text-muted-foreground/90 hover:text-foreground transition-colors"
          onClick={() => setEditing(true)}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {value}
          </ReactMarkdown>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors text-left w-full"
        >
          {placeholder}
        </button>
      )}
    </div>
  );
}

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
      updates.startTime = null;
      if (status === "SCHEDULED") updates.status = "INBOX";
    }
    updates.labels = labels.length > 0 ? labels : null;
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-start gap-3 pr-4">
            <button
              onClick={toggleComplete}
              className={cn(
                "mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all flex items-center justify-center",
                done
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary/70"
              )}
              title={done ? "Mark incomplete" : "Mark complete"}
            >
              {done && (
                <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "flex-1 bg-transparent text-lg font-semibold outline-none border-b border-transparent",
                "focus:border-border/60 transition-colors placeholder:text-muted-foreground/40",
                done && "line-through text-muted-foreground"
              )}
              placeholder="Task title"
            />
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Description */}
          <MarkdownField
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Add a description… (supports Markdown)"
            editRows={5}
          />

          {/* Notes */}
          <MarkdownField
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Add notes… (supports Markdown)"
            editRows={3}
          />

          {/* Metadata */}
          <div className="space-y-3 pt-1 border-t border-border/30">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 pt-1">
              Details
            </p>

            {/* Priority + Status */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger className="h-8 text-sm bg-transparent border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-8 text-sm bg-transparent border-border/50">
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
            </div>

            {/* Date / Time / Duration */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px] space-y-1">
                <label className="text-xs text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    if (e.target.value && status === "INBOX") setStatus("SCHEDULED");
                  }}
                  className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start time</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0 w-32"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Duration</label>
                <div className="relative w-24">
                  <Input
                    placeholder="30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                    className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0 pr-8"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 pointer-events-none">
                    min
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Labels
            </p>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border"
                  style={{
                    backgroundColor: getLabelColor(label) + "20",
                    borderColor: getLabelColor(label) + "50",
                    color: getLabelColor(label),
                  }}
                >
                  {label}
                  <button onClick={() => removeLabel(label)} className="hover:opacity-70 transition-opacity ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Input
                placeholder="Add label…"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addLabel(labelInput); }
                  if (e.key === ",") { e.preventDefault(); addLabel(labelInput); }
                }}
                className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0"
              />
              {labelInput && labelPalette.filter(l =>
                l.name.toLowerCase().includes(labelInput.toLowerCase()) && !labels.includes(l.name)
              ).length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/60 rounded-lg shadow-lg z-50 py-1 max-h-36 overflow-y-auto">
                  {labelPalette
                    .filter(l => l.name.toLowerCase().includes(labelInput.toLowerCase()) && !labels.includes(l.name))
                    .map(l => (
                      <button
                        key={l.name}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 flex items-center gap-2"
                        onClick={() => addLabel(l.name)}
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
