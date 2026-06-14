"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface GeneratePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
}

export function GeneratePromptModal({ open, onOpenChange, taskId, taskTitle }: GeneratePromptModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setGenerated(false);
    setPrompt("");
    const res = await fetch("/api/ai/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to generate prompt");
      return;
    }
    setPrompt(data.prompt);
    setGenerated(true);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setPrompt("");
      setGenerated(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Generate AI Agent Prompt
          </DialogTitle>
          <DialogDescription className="truncate">
            Task: {taskTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!generated ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground text-center">
                Generate a ready-to-paste prompt for any AI agent (Claude Code, ChatGPT, etc.)
              </p>
              <Button onClick={generate} disabled={loading} data-testid="generate-btn">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Prompt
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={14}
                className="text-sm font-mono resize-y"
                data-testid="generated-prompt"
              />
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerate"}
                </Button>
                <Button onClick={copyToClipboard} data-testid="copy-prompt-btn">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
