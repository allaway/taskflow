"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bot, Key, User, Loader2, CheckCircle2, Eye, EyeOff, Trash2, Plus, Copy, CalendarDays, Link2, Link2Off, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface UserSettings {
  id: string;
  name: string;
  email: string;
  aiProvider: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiSchedulingModel: string | null;
  dailyBudgetHours: number;
  googleCalendarConnected: boolean;
  googleEmail: string | null;
  claudeCodeRoutineId: string | null;
  claudeCodeRoutineToken: string | null;
  hasClaudeCodeRoutine: boolean;
}

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function FieldRow({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-5 rounded-xl border border-border/60 bg-card">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Separator className="opacity-50" />
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [name, setName] = useState("");
  const [dailyBudgetHours, setDailyBudgetHours] = useState(8);
  const [aiProvider, setAiProvider] = useState("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiSchedulingModel, setAiSchedulingModel] = useState("");
  const [routineId, setRoutineId] = useState("");
  const [routineToken, setRoutineToken] = useState("");
  const [showRoutineToken, setShowRoutineToken] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);

  // Google Calendar OAuth state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // API tokens
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setName(data.name ?? "");
        setAiProvider(data.aiProvider ?? "anthropic");
        setAiApiKey(data.aiApiKey ?? "");
        setAiModel(data.aiModel ?? (data.aiProvider === "openrouter" ? "anthropic/claude-opus-4-5" : "claude-opus-4-5"));
        setAiSchedulingModel(data.aiSchedulingModel ?? "");
        setDailyBudgetHours(data.dailyBudgetHours ?? 8);
        setGoogleConnected(data.googleCalendarConnected ?? false);
        setGoogleEmail(data.googleEmail ?? null);
        setRoutineId(data.claudeCodeRoutineId ?? "");
        setRoutineToken(data.claudeCodeRoutineToken ?? "");
        setLoading(false);

        // Show success/error toasts from OAuth callback redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "1") {
          toast.success("Google Calendar connected!");
          window.history.replaceState({}, "", window.location.pathname + "?tab=calendar");
        } else if (params.get("error")) {
          const errMap: Record<string, string> = {
            access_denied: "Google Calendar access was denied.",
            invalid_state: "Invalid OAuth state — please try again.",
            missing_tokens: "Google did not return tokens — please try again.",
            server_error: "Something went wrong — please try again.",
          };
          setCalendarError(errMap[params.get("error")!] ?? "Unknown error");
          window.history.replaceState({}, "", window.location.pathname + "?tab=calendar");
        }
      });

    fetch("/api/tokens")
      .then((r) => r.json())
      .then((data) => {
        setTokens(data);
        setTokensLoading(false);
      });
  }, []);

  async function saveAiSettings() {
    setSaving(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiProvider, aiApiKey: aiApiKey || undefined, aiModel, aiSchedulingModel: aiSchedulingModel || undefined }),
    });
    setSaving(false);
    if (res.ok) toast.success("AI settings saved");
    else toast.error("Failed to save settings");
  }

  async function saveRoutineSettings() {
    setSavingRoutine(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claudeCodeRoutineId: routineId || null,
        claudeCodeRoutineToken: routineToken || null,
      }),
    });
    setSavingRoutine(false);
    if (res.ok) toast.success("Routine settings saved");
    else toast.error("Failed to save routine settings");
  }

  async function saveProfileSettings() {
    setSaving(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dailyBudgetHours }),
    });
    setSaving(false);
    if (res.ok) toast.success("Profile saved");
    else toast.error("Failed to save profile");
  }

  async function disconnectGoogle() {
    setDisconnecting(true);
    const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
    setDisconnecting(false);
    if (res.ok) {
      setGoogleConnected(false);
      setGoogleEmail(null);
      toast.success("Google Calendar disconnected");
    } else {
      toast.error("Failed to disconnect");
    }
  }

  async function testConnection() {
    if (!aiApiKey || aiApiKey.includes("...")) {
      toast.error("Enter a full API key to test");
      return;
    }
    setTesting(true);
    const res = await fetch("/api/ai/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: aiProvider, apiKey: aiApiKey, model: aiModel }),
    });
    const data = await res.json();
    setTesting(false);
    if (data.success) toast.success("Connection successful!");
    else toast.error("Connection failed. Check your API key and model.");
  }

  async function createToken() {
    if (!newTokenName.trim()) return;
    setCreatingToken(true);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTokenName.trim() }),
    });
    setCreatingToken(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(`Failed to create token (${res.status})${err?.error ? `: ${JSON.stringify(err.error)}` : ""}`);
      return;
    }
    const data = await res.json();
    setTokens((prev) => [data, ...prev]);
    setRevealedToken(data.token);
    setNewTokenName("");
  }

  async function revokeToken(id: string) {
    const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTokens((prev) => prev.filter((t) => t.id !== id));
      toast.success("Token revoked");
    } else {
      toast.error("Failed to revoke token");
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    toast.success("Copied to clipboard");
  }

  const defaultModel = aiProvider === "openrouter" ? "anthropic/claude-opus-4-5" : "claude-opus-4-5";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Tabs defaultValue={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") || "ai"}>
        <TabsList className="bg-muted/50 border border-border/60 h-8 p-0.5 gap-0.5">
          <TabsTrigger value="ai" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <Bot className="h-3.5 w-3.5" />AI
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <CalendarDays className="h-3.5 w-3.5" />Calendar
          </TabsTrigger>
          <TabsTrigger value="api" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <Key className="h-3.5 w-3.5" />API
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <User className="h-3.5 w-3.5" />Profile
          </TabsTrigger>
        </TabsList>

        {/* AI */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <Section title="AI Provider" description="Controls which service handles scheduling and prompt generation.">
            <div className="space-y-3">
              <FieldRow label="Provider">
                <Select
                  value={aiProvider}
                  onValueChange={(v) => {
                    const val = v ?? "anthropic";
                    setAiProvider(val);
                    setAiModel(val === "openrouter" ? "anthropic/claude-opus-4-5" : "claude-opus-4-5");
                  }}
                >
                  <SelectTrigger className="bg-muted/40 border-border/60 h-9" data-testid="ai-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (direct)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow
                label="API Key"
                hint={aiProvider === "anthropic" ? "console.anthropic.com" : "openrouter.ai/keys"}
              >
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={aiProvider === "anthropic" ? "sk-ant-api03-…" : "sk-or-v1-…"}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="bg-muted/40 border-border/60 h-9 pr-10 focus-visible:ring-0 focus-visible:border-primary/60"
                    data-testid="ai-api-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </FieldRow>

              <FieldRow
                label="Model"
                hint={<>Default: <code className="bg-muted/60 px-1 py-0.5 rounded text-[10px]">{defaultModel}</code></>}
              >
                <Input
                  placeholder={defaultModel}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
                  data-testid="ai-model-input"
                />
              </FieldRow>

              <FieldRow
                label="Scheduling model override"
                hint="Optional — use a faster/cheaper model only for scheduling."
              >
                <Input
                  placeholder="Leave blank to use main model"
                  value={aiSchedulingModel}
                  onChange={(e) => setAiSchedulingModel(e.target.value)}
                  className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
                />
              </FieldRow>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-border/60 bg-transparent"
                onClick={testConnection}
                disabled={testing}
              >
                {testing
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                }
                Test connection
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={saveAiSettings}
                disabled={saving}
                data-testid="save-ai-settings-btn"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </Section>
          <Section
            title="Claude Code Routines"
            description="Delegate tasks directly to a Claude Code Routine — it runs in Anthropic's cloud and can use your MCP connection to read and update tasks automatically."
          >
            <div className="space-y-3">
              <FieldRow
                label="Routine ID"
                hint={
                  <>
                    From your Claude Code Routine&apos;s API trigger settings.{" "}
                    <a href="https://claude.ai/claude-code/routines" target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/40 hover:decoration-primary inline-flex items-center gap-0.5">
                      Open Routines <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                }
              >
                <Input
                  placeholder="routine_01HJKLMN…"
                  value={routineId}
                  onChange={(e) => setRoutineId(e.target.value)}
                  className="bg-muted/40 border-border/60 h-9 font-mono text-xs focus-visible:ring-0 focus-visible:border-primary/60"
                />
              </FieldRow>

              <FieldRow
                label="Routine Token"
                hint="Bearer token from the routine's API trigger page. Stored encrypted."
              >
                <div className="relative">
                  <Input
                    type={showRoutineToken ? "text" : "password"}
                    placeholder="sk-ant-oat01-…"
                    value={routineToken}
                    onChange={(e) => setRoutineToken(e.target.value)}
                    className="bg-muted/40 border-border/60 h-9 font-mono text-xs pr-10 focus-visible:ring-0 focus-visible:border-primary/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRoutineToken((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showRoutineToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </FieldRow>

              <FieldRow label="Suggested routine prompt" hint="Paste this as your routine's saved prompt in Claude Code.">
                <div className="relative group">
                  <pre className="bg-muted/40 border border-border/60 rounded-md p-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap text-muted-foreground">
{`You are an AI agent connected to my task management system via the TaskFlow MCP server.

When triggered, you will receive a JSON object with: taskId, title, priority, description, notes, and mcpUrl.

Steps:
1. Parse the task data from the input
2. Call get_task with the taskId to get the latest details
3. Work on the task thoroughly based on its title, description, and notes
4. Use update_task to write progress and results back to the task notes (Markdown)
5. Call complete_task when finished

Be thorough. Write real, useful output — not a summary of what you would do.`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      navigator.clipboard.writeText(`You are an AI agent connected to my task management system via the TaskFlow MCP server.\n\nWhen triggered, you will receive a JSON object with: taskId, title, priority, description, notes, and mcpUrl.\n\nSteps:\n1. Parse the task data from the input\n2. Call get_task with the taskId to get the latest details\n3. Work on the task thoroughly based on its title, description, and notes\n4. Use update_task to write progress and results back to the task notes (Markdown)\n5. Call complete_task when finished\n\nBe thorough. Write real, useful output — not a summary of what you would do.`);
                      toast.success("Prompt copied");
                    }}
                    title="Copy prompt"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </FieldRow>
            </div>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={saveRoutineSettings}
              disabled={savingRoutine}
            >
              {savingRoutine && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </Section>
        </TabsContent>

        {/* Calendar */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          <Section
            title="Google Calendar"
            description="Connect your Google account to show calendar events alongside your tasks."
          >
            {calendarError && (
              <p className="text-[11px] text-destructive px-3 py-2 bg-destructive/5 border border-destructive/20 rounded-md">
                {calendarError}
              </p>
            )}

            {googleConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-emerald-800">Connected</p>
                    {googleEmail && (
                      <p className="text-[11px] text-emerald-600 truncate">{googleEmail}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  All your Google Calendars will be shown in the Today and Week views.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border/60 bg-transparent gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  onClick={disconnectGoogle}
                  disabled={disconnecting}
                >
                  {disconnecting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Link2Off className="h-3.5 w-3.5" />
                  }
                  Disconnect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Grant read-only access to your Google Calendars. Events will appear alongside your tasks in the Today and Week views.
                </p>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={async () => {
                    const res = await fetch("/api/auth/google");
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </Section>
        </TabsContent>

        {/* API Tokens */}
        <TabsContent value="api" className="mt-4 space-y-4">
          <Section title="API Tokens" description="Use tokens to push tasks from any external service.">
            <FieldRow
              label="Inbound endpoint"
              hint="POST tasks here with Authorization: Bearer <token>"
            >
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${origin}/api/webhooks`}
                  className="bg-muted/40 border-border/60 h-9 text-muted-foreground font-mono text-xs focus-visible:ring-0"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-border/60 bg-transparent shrink-0"
                  onClick={() => copyToken(`${origin}/api/webhooks`)}
                  title="Copy URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </FieldRow>

            <Separator className="opacity-50" />

            {/* New token revealed */}
            {revealedToken && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-amber-400">Copy this token now — it won&apos;t be shown again.</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={revealedToken}
                    className="bg-muted/40 border-amber-500/40 h-9 font-mono text-xs focus-visible:ring-0"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border/60 bg-transparent shrink-0"
                    onClick={() => copyToken(revealedToken)}
                    title="Copy token"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <button
                  className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={() => setRevealedToken(null)}
                >
                  I&apos;ve saved it — dismiss
                </button>
              </div>
            )}

            {/* Create new token */}
            <div className="flex gap-2">
              <Input
                placeholder="Token name (e.g. n8n, Zapier, IFTTT)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createToken(); }}
                className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
              />
              <Button
                size="sm"
                className="h-9 text-xs shrink-0"
                onClick={createToken}
                disabled={creatingToken || !newTokenName.trim()}
              >
                {creatingToken
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />
                }
                <span className="ml-1.5">Create</span>
              </Button>
            </div>

            {/* Token list */}
            {tokensLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-3">No tokens yet.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/40"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{token.name}</p>
                      <p className="text-[11px] text-muted-foreground/60 font-mono">
                        {token.tokenPrefix}
                        {token.lastUsedAt && (
                          <span className="ml-2 not-italic">
                            last used {new Date(token.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                      onClick={() => revokeToken(token.id)}
                      title="Revoke token"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Section title="Profile" description="Your account details.">
            <div className="space-y-3">
              <FieldRow label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
                  data-testid="profile-name-input"
                />
              </FieldRow>
              <FieldRow label="Daily work budget (hours)" hint="Controls the time budget indicator on the Today view.">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={dailyBudgetHours}
                  onChange={(e) => setDailyBudgetHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 8)))}
                  className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60 w-24"
                />
              </FieldRow>
              <FieldRow label="Email" hint="Email cannot be changed.">
                <Input
                  value={settings?.email ?? ""}
                  disabled
                  className="bg-muted/40 border-border/60 h-9 text-muted-foreground"
                />
              </FieldRow>
            </div>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={saveProfileSettings}
              disabled={saving}
              data-testid="save-profile-btn"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
