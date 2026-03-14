"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bot, Webhook, User, Loader2, CheckCircle2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface UserSettings {
  id: string;
  name: string;
  email: string;
  aiProvider: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiSchedulingModel: string | null;
  n8nWebhookSecret: string | null;
  n8nOutboundUrl: string | null;
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
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [aiProvider, setAiProvider] = useState("anthropic");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiSchedulingModel, setAiSchedulingModel] = useState("");
  const [n8nSecret, setN8nSecret] = useState("");
  const [n8nOutboundUrl, setN8nOutboundUrl] = useState("");

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
        setN8nSecret(data.n8nWebhookSecret ?? "");
        setN8nOutboundUrl(data.n8nOutboundUrl ?? "");
        setLoading(false);
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

  async function saveProfileSettings() {
    setSaving(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (res.ok) toast.success("Profile saved");
    else toast.error("Failed to save profile");
  }

  async function saveN8nSettings() {
    setSaving(true);
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n8nWebhookSecret: n8nSecret || undefined, n8nOutboundUrl: n8nOutboundUrl || undefined }),
    });
    setSaving(false);
    if (res.ok) toast.success("N8N settings saved");
    else toast.error("Failed to save N8N settings");
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

  async function generateWebhookSecret() {
    setGenerating(true);
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    setN8nSecret(Array.from(array, (b) => b.toString(16).padStart(2, "0")).join(""));
    setGenerating(false);
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

      <Tabs defaultValue="ai">
        <TabsList className="bg-muted/50 border border-border/60 h-8 p-0.5 gap-0.5">
          <TabsTrigger value="ai" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <Bot className="h-3.5 w-3.5" />AI
          </TabsTrigger>
          <TabsTrigger value="n8n" className="flex-1 h-7 gap-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-none">
            <Webhook className="h-3.5 w-3.5" />N8N
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
        </TabsContent>

        {/* N8N */}
        <TabsContent value="n8n" className="mt-4 space-y-4">
          <Section title="N8N Integration" description="Connect N8N workflows to send and receive tasks.">
            <div className="space-y-3">
              <FieldRow
                label="Inbound webhook secret"
                hint={
                  <span>
                    Webhook URL: <code className="bg-muted/60 px-1 py-0.5 rounded text-[10px]">{origin}/api/webhooks/n8n</code>
                    <br />Set <code className="bg-muted/60 px-1 py-0.5 rounded text-[10px]">Authorization: Bearer &lt;secret&gt;</code> in your N8N HTTP node.
                  </span>
                }
              >
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Your webhook bearer token"
                    value={n8nSecret}
                    onChange={(e) => setN8nSecret(e.target.value)}
                    className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
                    data-testid="n8n-secret-input"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border/60 bg-transparent shrink-0"
                    onClick={generateWebhookSecret}
                    disabled={generating}
                    title="Generate random secret"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </FieldRow>

              <FieldRow
                label="Outbound webhook URL"
                hint="Used when you click &quot;Send to N8N&quot; on a task card. Optional."
              >
                <Input
                  type="url"
                  placeholder="https://your-n8n.instance/webhook/..."
                  value={n8nOutboundUrl}
                  onChange={(e) => setN8nOutboundUrl(e.target.value)}
                  className="bg-muted/40 border-border/60 h-9 focus-visible:ring-0 focus-visible:border-primary/60"
                  data-testid="n8n-outbound-url-input"
                />
              </FieldRow>
            </div>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={saveN8nSettings}
              disabled={saving}
              data-testid="save-n8n-settings-btn"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
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
