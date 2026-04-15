"use client";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, CheckCircle2, AlertCircle, Loader2, Wrench, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";

type AgentEvent =
  | { type: "start" }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done"; taskId: string }
  | { type: "error"; message: string };

type LogEntry =
  | { kind: "thinking"; text: string }
  | { kind: "tool"; name: string; detail: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

function toolLabel(name: string): string {
  switch (name) {
    case "write_notes": return "Writing notes";
    case "complete_task": return "Completing task";
    case "create_subtask": return "Creating subtask";
    default: return name;
  }
}

function toolIcon(name: string) {
  switch (name) {
    case "write_notes": return <FileText className="h-3.5 w-3.5" />;
    case "complete_task": return <CheckCircle2 className="h-3.5 w-3.5" />;
    default: return <Wrench className="h-3.5 w-3.5" />;
  }
}

function toolDetail(name: string, input: Record<string, unknown>): string {
  if (name === "write_notes") {
    const preview = String(input.content ?? "").slice(0, 80);
    return preview.length < String(input.content ?? "").length ? `${preview}…` : preview;
  }
  if (name === "complete_task") return String(input.summary ?? "");
  if (name === "create_subtask") return String(input.title ?? "");
  return "";
}

interface AgentRunModalProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export function AgentRunModal({ task, open, onOpenChange, onDone }: AgentRunModalProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [pendingText, setPendingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && status === "idle") {
      startAgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, pendingText]);

  function flushPending(text: string) {
    if (!text.trim()) return;
    setLog((prev) => [...prev, { kind: "thinking", text: text.trim() }]);
  }

  async function startAgent() {
    setStatus("running");
    setLog([]);
    setPendingText("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`/api/tasks/${task.id}/run-agent`, {
        method: "POST",
        signal: abort.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setLog([{ kind: "error", message: msg }]);
        setStatus("error");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: AgentEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "text") {
            accText += event.text;
            setPendingText(accText);
          }

          if (event.type === "tool_call") {
            // Flush accumulated text first
            if (accText.trim()) {
              flushPending(accText);
              accText = "";
              setPendingText("");
            }
            const detail = toolDetail(event.name, event.input);
            setLog((prev) => [...prev, { kind: "tool", name: event.name, detail }]);
          }

          if (event.type === "done") {
            if (accText.trim()) flushPending(accText);
            setPendingText("");
            setLog((prev) => [...prev, { kind: "done" }]);
            setStatus("done");
            onDone?.();
          }

          if (event.type === "error") {
            if (accText.trim()) flushPending(accText);
            setPendingText("");
            setLog((prev) => [...prev, { kind: "error", message: event.message }]);
            setStatus("error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setLog((prev) => [...prev, { kind: "error", message: (err as Error).message }]);
        setStatus("error");
      }
    }
  }

  function handleClose() {
    if (status === "running") {
      abortRef.current?.abort();
    }
    onOpenChange(false);
    // Reset for next open
    setTimeout(() => {
      setStatus("idle");
      setLog([]);
      setPendingText("");
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            AI Agent — {task.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {status === "running" && "Working on your task…"}
            {status === "done" && "Task complete. Notes have been updated."}
            {status === "error" && "Agent encountered an error."}
            {status === "idle" && "Starting…"}
          </DialogDescription>
        </DialogHeader>

        {/* Output log */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 font-mono text-xs min-h-0">
          {log.map((entry, i) => {
            if (entry.kind === "thinking") {
              return (
                <div key={i} className="text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {entry.text}
                </div>
              );
            }
            if (entry.kind === "tool") {
              return (
                <div key={i} className="flex items-start gap-2 text-primary/80">
                  <span className="mt-0.5 shrink-0">{toolIcon(entry.name)}</span>
                  <span className="font-medium">{toolLabel(entry.name)}</span>
                  {entry.detail && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50" />
                      <span className="text-muted-foreground truncate">{entry.detail}</span>
                    </>
                  )}
                </div>
              );
            }
            if (entry.kind === "done") {
              return (
                <div key={i} className="flex items-center gap-2 text-green-600 dark:text-green-500 font-medium pt-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </div>
              );
            }
            if (entry.kind === "error") {
              return (
                <div key={i} className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-wrap">{entry.message}</span>
                </div>
              );
            }
            return null;
          })}

          {/* Streaming text */}
          {status === "running" && pendingText && (
            <div className="text-foreground/70 whitespace-pre-wrap leading-relaxed">
              {pendingText}
            </div>
          )}

          {/* Blinking cursor while running */}
          {status === "running" && (
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <Loader2 className={cn("h-3.5 w-3.5 animate-spin")} />
              <span>thinking…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex justify-end gap-2 shrink-0">
          {status === "done" && (
            <Button size="sm" onClick={handleClose}>
              Close
            </Button>
          )}
          {status === "error" && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setStatus("idle"); setLog([]); setPendingText(""); startAgent(); }}>
                Retry
              </Button>
              <Button size="sm" onClick={handleClose}>Close</Button>
            </>
          )}
          {status === "running" && (
            <Button size="sm" variant="ghost" onClick={handleClose}>
              Stop
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
