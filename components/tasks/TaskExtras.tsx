"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ListTree,
  Link2,
  MessageSquare,
  X,
  Plus,
  Github,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { Task } from "@prisma/client";

interface SubtaskRow {
  id: string;
  title: string;
  status: string;
}

interface LinkRow {
  id: string;
  provider: "GITHUB" | "JIRA" | "URL";
  url: string;
  externalKey: string;
  syncOnComplete: boolean;
  lastSyncStatus: string | null;
}

interface CommentRow {
  id: string;
  authorType: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
      {icon}
      {children}
    </p>
  );
}

export function SubtasksSection({ task }: { task: Task }) {
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/tasks?parentId=${task.id}`);
    if (res.ok) setSubtasks(await res.json());
  }, [task.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, parentId: task.id }),
    });
    if (!res.ok) toast.error("Failed to add subtask");
    refresh();
  }

  async function toggle(sub: SubtaskRow) {
    await fetch(`/api/tasks/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: sub.status === "COMPLETED" ? "INBOX" : "COMPLETED" }),
    });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    refresh();
  }

  // Subtasks can't nest — don't show the section on subtasks themselves
  if (task.parentId) return null;

  return (
    <div className="space-y-2">
      <SectionLabel icon={<ListTree className="h-3 w-3" />}>
        Subtasks{subtasks.length > 0 && ` (${subtasks.filter((s) => s.status === "COMPLETED").length}/${subtasks.length})`}
      </SectionLabel>
      <div className="space-y-1">
        {subtasks.map((sub) => (
          <div key={sub.id} className="group flex items-center gap-2 text-sm">
            <button
              onClick={() => toggle(sub)}
              className={cn(
                "h-4 w-4 shrink-0 rounded-full border-2 transition-all flex items-center justify-center",
                sub.status === "COMPLETED" ? "bg-primary border-primary" : "border-border hover:border-primary/70"
              )}
            >
              {sub.status === "COMPLETED" && (
                <svg className="h-2 w-2 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className={cn("flex-1 min-w-0 truncate", sub.status === "COMPLETED" && "line-through text-muted-foreground")}>
              {sub.title}
            </span>
            <button
              onClick={() => remove(sub.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a subtask…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addSubtask(); }
          }}
          className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0"
          data-testid="subtask-input"
        />
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={addSubtask} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const PROVIDER_META: Record<LinkRow["provider"], { label: string; icon: React.ReactNode }> = {
  GITHUB: { label: "GitHub", icon: <Github className="h-3.5 w-3.5" /> },
  JIRA: { label: "Jira", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  URL: { label: "Link", icon: <ExternalLink className="h-3.5 w-3.5" /> },
};

export function LinksSection({ task }: { task: Task }) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [newUrl, setNewUrl] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}/links`);
    if (res.ok) setLinks(await res.json());
  }, [task.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addLink() {
    const url = newUrl.trim();
    if (!url) return;
    const res = await fetch(`/api/tasks/${task.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      setNewUrl("");
      refresh();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error?.fieldErrors?.url?.[0] ?? "Invalid URL");
    }
  }

  async function toggleSync(link: LinkRow) {
    await fetch(`/api/tasks/${task.id}/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncOnComplete: !link.syncOnComplete }),
    });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${task.id}/links/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-2">
      <SectionLabel icon={<Link2 className="h-3 w-3" />}>Linked issues</SectionLabel>
      <div className="space-y-1.5">
        {links.map((link) => (
          <div key={link.id} className="group flex items-center gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">{PROVIDER_META[link.provider].icon}</span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate flex-1 min-w-0"
            >
              {link.externalKey}
            </a>
            {link.provider !== "URL" && (
              <button
                onClick={() => toggleSync(link)}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-md ring-1 shrink-0 transition-colors",
                  link.syncOnComplete
                    ? "text-green-700 bg-green-50 ring-green-200"
                    : "text-muted-foreground bg-muted ring-border"
                )}
                title="When on, completing this task resolves the linked issue"
              >
                {link.syncOnComplete ? "auto-resolve on" : "auto-resolve off"}
              </button>
            )}
            {link.lastSyncStatus && link.lastSyncStatus !== "ok" && (
              <span className="text-[10px] text-rose-600 truncate max-w-[140px]" title={link.lastSyncStatus}>
                sync failed
              </span>
            )}
            <button
              onClick={() => remove(link.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Paste a GitHub issue / Jira issue / URL…"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addLink(); }
          }}
          className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0"
          data-testid="link-input"
        />
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={addLink} disabled={!newUrl.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CommentsSection({ task }: { task: Task }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/tasks/${task.id}/comments`);
    if (res.ok) setComments(await res.json());
  }, [task.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addComment() {
    const content = newComment.trim();
    if (!content) return;
    setNewComment("");
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) toast.error("Failed to add comment");
    refresh();
  }

  return (
    <div className="space-y-2">
      <SectionLabel icon={<MessageSquare className="h-3 w-3" />}>
        Comments{comments.length > 0 && ` (${comments.length})`}
      </SectionLabel>
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg bg-muted/30 border border-border/40 px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium">{c.authorName ?? (c.authorType === "agent" ? "Agent" : "You")}</span>
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addComment(); }
          }}
          className="h-8 text-sm bg-transparent border-border/50 focus-visible:ring-0"
          data-testid="comment-input"
        />
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={addComment} disabled={!newComment.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
