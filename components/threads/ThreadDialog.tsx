"use client";
import { useEffect, useState } from "react";
import { Bot, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThreadChat, type ChatMessage } from "./ThreadChat";
import { providerLabel, ThreadStatusBadge } from "./threadMeta";

interface LoadedThread {
  id: string;
  title: string;
  provider: string;
  status: string;
  url: string | null;
  messages: ChatMessage[];
}

interface ThreadDialogProps {
  threadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First message to send if the thread is empty (used when delegating). */
  autoSend?: string;
  onChanged?: () => void;
}

/** Read and reply to one agent thread without leaving TaskFlow. */
export function ThreadDialog({ threadId, open, onOpenChange, autoSend, onChanged }: ThreadDialogProps) {
  const [thread, setThread] = useState<LoadedThread | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !threadId) return;
    let active = true;
    fetch(`/api/threads/${threadId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((t: LoadedThread) => {
        if (active) {
          setThread(t);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [open, threadId]);

  const loaded = thread && thread.id === threadId ? thread : null;
  const external = loaded ? loaded.provider !== "taskflow" : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-[75vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base pr-6">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{loaded?.title ?? "Thread"}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            {loaded && (
              <>
                <span>{providerLabel(loaded.provider)}</span>
                <ThreadStatusBadge status={loaded.status} />
                {loaded.url && (
                  <a
                    href={loaded.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                  >
                    Open in {providerLabel(loaded.provider)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="p-5 text-sm text-destructive">Couldn&apos;t load this thread.</p>
        ) : loaded ? (
          <ThreadChat
            key={loaded.id}
            endpoint={`/api/threads/${loaded.id}/messages`}
            extraBody={{ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }}
            initialMessages={loaded.messages}
            autoSend={external ? undefined : autoSend}
            onTurnDone={onChanged}
            placeholder={external ? "Leave a reply for the agent…" : "Reply to the agent…"}
            emptyHint={
              external
                ? "This work runs in another tool. Updates the agent posts over MCP show up here, and replies you leave are passed to it the next time it checks in."
                : undefined
            }
            workingLabel={external ? "Saving…" : "Working…"}
          />
        ) : (
          <div className="flex-1 p-5 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
