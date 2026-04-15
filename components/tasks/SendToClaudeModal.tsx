"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Bot, Terminal } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@prisma/client";

interface SendToClaudeModalProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildHandoffPrompt(task: Task, mcpUrl: string): string {
  const lines: string[] = [];

  lines.push(`Please work on the following task from my task management system:`);
  lines.push(``);
  lines.push(`**${task.title}** (Priority: ${task.priority})`);
  if (task.description) {
    lines.push(``);
    lines.push(`Description:`);
    lines.push(task.description);
  }
  if (task.notes) {
    lines.push(``);
    lines.push(`Notes:`);
    lines.push(task.notes);
  }
  lines.push(``);

  if (mcpUrl) {
    lines.push(`I've connected my task manager via MCP at: ${mcpUrl}`);
    lines.push(``);
    lines.push(`You can use these MCP tools to track your progress:`);
    lines.push(`- \`get_agent_tasks\` — see all tasks I've queued for you`);
    lines.push(`- \`claim_agent_task\` with id "${task.id}" — claim this task to start working`);
    lines.push(`- \`get_task\` with id "${task.id}" — get the latest task details`);
    lines.push(`- \`update_task\` — add progress notes as you go`);
    lines.push(`- \`complete_task\` — mark done when finished`);
    lines.push(``);
    lines.push(`Task ID: ${task.id}`);
  }

  return lines.join("\n");
}

export function SendToClaudeModal({ task, open, onOpenChange }: SendToClaudeModalProps) {
  const [copied, setCopied] = useState(false);

  const mcpUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/mcp`
    : "/api/mcp";

  const prompt = buildHandoffPrompt(task, mcpUrl);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function openInClaude() {
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Send to Claude
          </DialogTitle>
          <DialogDescription>
            Copy the prompt below and paste it into Claude Code or Claude.ai
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task summary */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium truncate">{task.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Priority: {task.priority}</p>
          </div>

          {/* Generated prompt */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Prompt
            </p>
            <pre className="text-xs bg-muted/40 border rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto">
              {prompt}
            </pre>
          </div>

          {/* MCP note */}
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <Terminal className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Claude Code can track progress automatically via MCP. Add this to your{" "}
                <span className="font-mono text-foreground">claude_desktop_config.json</span>:
              </p>
              <pre className="bg-background/60 rounded px-2 py-1 font-mono text-[11px] overflow-x-auto whitespace-pre">
{`"taskflow": {
  "type": "http",
  "url": "${mcpUrl}"
}`}
              </pre>
              <p className="text-[10px] text-muted-foreground/60">
                Generate an API token in Settings → API Tokens for authentication.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={copyPrompt} className="flex-1">
            {copied ? (
              <><Check className="h-4 w-4 mr-2" /> Copied!</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" /> Copy Prompt</>
            )}
          </Button>
          <Button variant="outline" onClick={openInClaude}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Claude.ai
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
