"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThreadChat, type ChatMessage } from "./ThreadChat";

interface AssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  /** Called after each turn — the assistant may have changed the day. */
  onChanged: () => void;
}

/** The daily assistant: one conversation per day that can do anything in the app. */
export function AssistantDialog({ open, onOpenChange, date, onChanged }: AssistantDialogProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const [history, setHistory] = useState<{ date: string; messages: ChatMessage[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/assistant?date=${dateStr}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        if (active) setHistory({ date: dateStr, messages: d.messages ?? [] });
      })
      .catch(() => {
        if (active) setHistory({ date: dateStr, messages: [] });
      });
    return () => {
      active = false;
    };
  }, [open, dateStr]);

  const ready = history?.date === dateStr;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-[75vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            Assistant — {format(date, "EEEE, MMM d")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ask for any change to your day: move things, add tasks, run work in parallel, triage catch-up.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <ThreadChat
            key={dateStr}
            endpoint="/api/assistant"
            extraBody={{ date: dateStr, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }}
            initialMessages={history.messages}
            onTurnDone={onChanged}
            placeholder="e.g. Push everything after 3pm to tomorrow"
            emptyHint="Tell the assistant what to change about your day."
            workingLabel="Thinking…"
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
