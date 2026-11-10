"use client";
import { useEffect, useState } from "react";
import { Bot, ExternalLink, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LINKABLE_PROVIDERS, providerLabel, ThreadStatusBadge } from "./threadMeta";

interface ThreadRow {
  id: string;
  title: string;
  provider: string;
  status: string;
  url: string | null;
  summary: string | null;
}

interface TaskThreadsProps {
  taskId: string;
  onOpenThread: (threadId: string) => void;
}

/** The agent threads gathered under one task, wherever each one runs. */
export function TaskThreads({ taskId, onOpenThread }: TaskThreadsProps) {
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [provider, setProvider] = useState<string>("claude");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/threads?taskId=${taskId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: ThreadRow[]) => {
        if (active) setThreads(rows);
      })
      .catch(() => {
        if (active) setThreads([]);
      });
    return () => {
      active = false;
    };
  }, [taskId, refresh]);

  async function linkThread(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, provider, url: url.trim(), title: title.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't link that thread — check the URL");
      return;
    }
    setUrl("");
    setTitle("");
    setLinking(false);
    setRefresh((r) => r + 1);
  }

  async function removeThread(id: string) {
    const res = await fetch(`/api/threads/${id}`, { method: "DELETE" });
    if (res.ok) setThreads((prev) => prev?.filter((t) => t.id !== id) ?? null);
    else toast.error("Failed to remove thread");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
          <Bot className="h-3 w-3" /> Agent threads
        </p>
        <button
          onClick={() => setLinking((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Link2 className="h-3 w-3" /> {linking ? "Cancel" : "Link a thread"}
        </button>
      </div>

      {linking && (
        <form onSubmit={linkThread} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-2">
          <Select value={provider} onValueChange={(v) => setProvider(v ?? "claude")}>
            <SelectTrigger className="h-8 w-32 text-xs bg-transparent border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINKABLE_PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>{providerLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="url"
            required
            autoFocus
            placeholder="https://… link to the conversation"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 flex-1 min-w-[200px] text-xs bg-transparent border-border/50 focus-visible:ring-0"
          />
          <Input
            placeholder="Name (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 w-40 text-xs bg-transparent border-border/50 focus-visible:ring-0"
          />
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving || !url.trim()}>
            {saving ? "Linking…" : "Link"}
          </Button>
        </form>
      )}

      {threads === null ? (
        <div className="h-9 rounded-lg bg-muted/40 animate-pulse" />
      ) : threads.length === 0 ? (
        !linking && (
          <p className="text-sm text-muted-foreground/40">
            No threads yet. Delegate this task, or link a conversation you already have going.
          </p>
        )
      ) : (
        <div className="space-y-1">
          {threads.map((t) => (
            <div
              key={t.id}
              className="group/thread flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 hover:border-border hover:bg-muted/30 transition-colors"
            >
              <button className="flex-1 min-w-0 text-left" onClick={() => onOpenThread(t.id)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{t.title}</span>
                  <ThreadStatusBadge status={t.status} />
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">{providerLabel(t.provider)}</span>
                </div>
                {t.summary && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.summary}</p>}
              </button>
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/60 hover:text-primary shrink-0"
                  title={`Open in ${providerLabel(t.provider)}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => removeThread(t.id)}
                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/thread:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                title="Remove thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
