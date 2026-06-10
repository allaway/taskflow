"use client";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, CheckCircle2, AlertCircle, Loader2, Wrench, ChevronRight, FileText, HelpCircle, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

type AgentEvent =
  | { type: "start"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "awaiting_input"; sessionId: string; question: string }
  | { type: "needs_review"; sessionId: string; summary: string }
  | { type: "done"; taskId: string; sessionId: string }
  | { type: "error"; message: string };

type LogEntry =
  | { kind: "thinking"; text: string }
  | { kind: "tool"; name: string; detail: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

function toolLabel(name: string): string {
  switch (name) {
    case "write_notes": return "Writing notes";
    case "submit_result": return "Submitting for review";
    case "ask_user": return "Asking you a question";
    case "create_subtask": return "Creating subtask";
    default: return name;
  }
}

function toolIcon(name: string) {
  switch (name) {
    case "write_notes": return <FileText className="h-3.5 w-3.5" />;
    case "submit_result": return <ClipboardCheck className="h-3.5 w-3.5" />;
    case "ask_user": return <HelpCircle className="h-3.5 w-3.5" />;
    default: return <Wrench className="h-3.5 w-3.5" />;
  }
}

function toolDetail(name: string, input: Record<string, unknown>): string {
  if (name === "write_notes") {
    const preview = String(input.content ?? "").slice(0, 80);
    return preview.length < String(input.content ?? "").length ? `${preview}…` : preview;
  }
  if (name === "submit_result") return String(input.summary ?? "");
  if (name === "ask_user") return String(input.question ?? "");
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
  const [status, setStatus] = useState<"idle" | "running" | "awaiting_input" | "needs_review" | "done" | "error">("idle");
  const [pendingText, setPendingText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [busy, setBusy] = useState(false);
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
  }, [log, pendingText, status]);

  function flushPending(text: string) {
    if (!text.trim()) return;
    setLog((prev) => [...prev, { kind: "thinking", text: text.trim() }]);
  }

  async function startAgent(resumeSessionId?: string) {
    setStatus("running");
    if (!resumeSessionId) setLog([]);
    setPendingText("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch(`/api/tasks/${task.id}/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resumeSessionId ? { sessionId: resumeSessionId } : {}),
        signal: abort.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setLog((prev) => [...prev, { kind: "error", message: msg }]);
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

          if (event.type === "start") {
            setSessionId(event.sessionId);
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

          if (event.type === "awaiting_input") {
            if (accText.trim()) flushPending(accText);
            setPendingText("");
            setSessionId(event.sessionId);
            setQuestion(event.question);
            setStatus("awaiting_input");
            onDone?.();
          }

          if (event.type === "needs_review") {
            if (accText.trim()) flushPending(accText);
            setPendingText("");
            setSessionId(event.sessionId);
            setReviewSummary(event.summary);
            setStatus("needs_review");
            onDone?.();
          }

          if (event.type === "done") {
            if (accText.trim()) flushPending(accText);
            setPendingText("");
            setLog((prev) => [...prev, { kind: "done" }]);
            setStatus((s) => (s === "needs_review" ? s : "done"));
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

  async function submitAnswer() {
    if (!sessionId || !answer.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/agent-sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to send answer");
      return;
    }
    setAnswer("");
    setQuestion("");
    // Resume the loop with the answer in context
    startAgent(sessionId);
  }

  async function acceptResult() {
    if (!sessionId) return;
    setBusy(true);
    const res = await fetch(`/api/agent-sessions/${sessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      const failed = (data.linkSync ?? []).filter((s: { ok: boolean }) => !s.ok);
      for (const f of failed) {
        toast.error(`Could not resolve ${f.provider} link ${f.externalKey}: ${f.error}`);
      }
      toast.success("Accepted — task completed");
      setStatus("done");
      onDone?.();
    } else {
      toast.error("Failed to accept");
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
      setSessionId(null);
      setQuestion("");
      setReviewSummary("");
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
            {status === "awaiting_input" && "The agent needs your input to continue."}
            {status === "needs_review" && "The agent finished — review its work below."}
            {status === "done" && "Session finished. Notes have been updated."}
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

          {/* Elicitation: agent asked a question */}
          {status === "awaiting_input" && (
            <div className="rounded-md border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2 font-sans">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> The agent is asking:
              </p>
              <p className="text-sm whitespace-pre-wrap">{question}</p>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                rows={2}
                className="text-sm bg-background"
                autoFocus
              />
              <Button size="sm" onClick={submitAnswer} disabled={busy || !answer.trim()}>
                Send answer &amp; continue
              </Button>
            </div>
          )}

          {/* Review gate: agent submitted its result */}
          {status === "needs_review" && (
            <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 p-3 space-y-2 font-sans">
              <p className="text-xs font-medium text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Submitted for your review:
              </p>
              <p className="text-sm whitespace-pre-wrap">{reviewSummary}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={acceptResult} disabled={busy}>
                  Accept &amp; complete task
                </Button>
                <Button size="sm" variant="outline" onClick={handleClose}>
                  Review later
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                You can also send the work back with feedback from the task&apos;s Agent activity panel.
              </p>
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
