"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "@/lib/agent";

export interface ChatMessage {
  id: string;
  role: string; // "user" | "agent" | "system"
  content: string;
}

interface ThreadChatProps {
  /** POST endpoint that streams the turn back as SSE. */
  endpoint: string;
  /** Extra fields sent with every message (e.g. date, timezone). */
  extraBody?: Record<string, unknown>;
  initialMessages: ChatMessage[];
  /** Sent automatically when the conversation is empty. */
  autoSend?: string;
  onTurnDone?: () => void;
  placeholder?: string;
  emptyHint?: string;
  /** Label shown while waiting for the stream. */
  workingLabel?: string;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

function toolLine(name: string, input: Record<string, unknown>): string {
  const detail = String(input.title ?? input.summary ?? input.content ?? input.intent ?? input.id ?? input.date ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 100);
  return `→ ${name}${detail ? `: ${detail}` : ""}`;
}

export function ThreadChat({
  endpoint,
  extraBody,
  initialMessages,
  autoSend,
  onTurnDone,
  placeholder = "Reply…",
  emptyHint,
  workingLabel = "Working…",
}: ThreadChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = useState("");
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function push(role: string, content: string) {
    if (!content.trim()) return;
    setMessages((prev) => [...prev, { id: nextId(), role, content: content.trim() }]);
  }

  async function send(content: string) {
    const text = content.trim();
    if (!text || running) return;
    setRunning(true);
    setInput("");
    push("user", text);

    let acc = "";
    const flush = () => {
      push("agent", acc);
      acc = "";
      setPending("");
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...extraBody, content: text }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        push("system", `Error: ${typeof data?.error === "string" ? data.error : "Request failed"}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
            acc += (acc ? "\n\n" : "") + event.text;
            setPending(acc);
          } else if (event.type === "tool_call") {
            flush();
            push("system", toolLine(event.name, event.input));
          } else if (event.type === "error") {
            flush();
            push("system", `Error: ${event.message}`);
          } else if (event.type === "done") {
            flush();
          }
        }
      }
      flush();
    } catch (err) {
      push("system", `Error: ${err instanceof Error ? err.message : "Connection lost"}`);
    } finally {
      setRunning(false);
      setPending("");
      onTurnDone?.();
    }
  }

  useEffect(() => {
    if (autoSend && initialMessages.length === 0 && !autoSent.current) {
      autoSent.current = true;
      send(autoSend);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0" data-testid="thread-messages">
        {messages.length === 0 && !running && emptyHint && (
          <p className="text-sm text-muted-foreground/70 text-center py-8">{emptyHint}</p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2 text-sm whitespace-pre-wrap break-words">
                {m.content}
              </div>
            </div>
          ) : m.role === "system" ? (
            <p
              key={m.id}
              className={cn(
                "text-[11px] font-mono break-words",
                m.content.startsWith("Error") || m.content.startsWith("✗")
                  ? "text-destructive"
                  : "text-muted-foreground/70"
              )}
            >
              {m.content}
            </p>
          ) : (
            <AgentBubble key={m.id} content={m.content} />
          )
        )}
        {pending && <AgentBubble content={pending} />}
        {running && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {workingLabel}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 px-4 py-3 border-t border-border/40 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="resize-none min-h-9 max-h-32 text-sm bg-muted/40 border-border/60 focus-visible:ring-0 focus-visible:border-primary/60"
          data-testid="thread-input"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={running || !input.trim()} title="Send">
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AgentBubble({ content }: { content: string }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-muted/60 px-3.5 py-2 text-sm leading-relaxed break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_code]:font-mono [&_code]:text-[12px] [&_pre]:overflow-x-auto [&_a]:text-primary [&_a]:underline [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
