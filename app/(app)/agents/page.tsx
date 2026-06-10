"use client";
import { useState, useEffect, useCallback } from "react";
import { Bot } from "lucide-react";
import { SessionCard } from "@/components/agents/AgentSessionPanel";
import type { AgentSessionDetail } from "@/lib/types";

const SECTION_ORDER: { title: string; statuses: string[] }[] = [
  { title: "Needs your attention", statuses: ["AWAITING_INPUT", "NEEDS_REVIEW"] },
  { title: "Working", statuses: ["ACTIVE", "PENDING"] },
  { title: "Recent", statuses: ["COMPLETE", "ERROR", "STALE"] },
];

/**
 * The agent inbox: every delegation session across tasks, with the ones
 * blocked on you (questions, reviews) at the top.
 */
export default function AgentsPage() {
  const [sessions, setSessions] = useState<AgentSessionDetail[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/agent-sessions");
    if (res.ok) setSessions(await res.json());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Every task you&apos;ve delegated to an AI agent — answer questions, review submitted work, and watch live sessions.
        </p>

        {loaded && sessions.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No agent sessions yet.</p>
            <p className="text-xs mt-1 opacity-70">
              Open a task and choose &ldquo;Delegate to AI&rdquo; to get started.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {SECTION_ORDER.map(({ title, statuses }) => {
            const group = sessions.filter((s) => statuses.includes(s.status));
            if (group.length === 0) return null;
            return (
              <section key={title}>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                  {title}
                </h2>
                <div className="space-y-2">
                  {group.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      titlePrefix={s.task?.title}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
