"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Bot, Webhook, Loader2, Check, Eye, EyeOff, RefreshCw } from "lucide-react";
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
        setAiProvider(data.aiProvider ?? "anthropic" as string);
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
      body: JSON.stringify({
        aiProvider,
        aiApiKey: aiApiKey || undefined,
        aiModel,
        aiSchedulingModel: aiSchedulingModel || undefined,
      }),
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
      body: JSON.stringify({
        n8nWebhookSecret: n8nSecret || undefined,
        n8nOutboundUrl: n8nOutboundUrl || undefined,
      }),
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
    const secret = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    setN8nSecret(secret);
    setGenerating(false);
  }

  const defaultModel = aiProvider === "openrouter" ? "anthropic/claude-opus-4-5" : "claude-opus-4-5";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <Tabs defaultValue="ai">
        <TabsList className="w-full">
          <TabsTrigger value="ai" className="flex-1 gap-1.5">
            <Bot className="h-3.5 w-3.5" />AI
          </TabsTrigger>
          <TabsTrigger value="n8n" className="flex-1 gap-1.5">
            <Webhook className="h-3.5 w-3.5" />N8N
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1 gap-1.5">
            <Settings className="h-3.5 w-3.5" />Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Provider</CardTitle>
              <CardDescription>Configure which AI service handles scheduling and prompt generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={aiProvider} onValueChange={(v) => {
                  const val = v ?? "anthropic";
                  setAiProvider(val);
                  setAiModel(val === "openrouter" ? "anthropic/claude-opus-4-5" : "claude-opus-4-5");
                }}>
                  <SelectTrigger data-testid="ai-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Direct)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={aiProvider === "anthropic" ? "sk-ant-api03-…" : "sk-or-v1-…"}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="pr-10"
                    data-testid="ai-api-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiProvider === "anthropic"
                    ? "Get your key at console.anthropic.com"
                    : "Get your key at openrouter.ai/keys"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input
                  placeholder={defaultModel}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  data-testid="ai-model-input"
                />
                <p className="text-xs text-muted-foreground">
                  Default: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{defaultModel}</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Scheduling Model Override <Badge variant="outline" className="ml-1 text-[10px]">optional</Badge></Label>
                <Input
                  placeholder="Use a faster/cheaper model for scheduling"
                  value={aiSchedulingModel}
                  onChange={(e) => setAiSchedulingModel(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" onClick={testConnection} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Test connection
                </Button>
                <Button onClick={saveAiSettings} disabled={saving} data-testid="save-ai-settings-btn">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="n8n" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">N8N Integration</CardTitle>
              <CardDescription>Connect N8N workflows to send and receive tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Inbound Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Your webhook bearer token"
                    value={n8nSecret}
                    onChange={(e) => setN8nSecret(e.target.value)}
                    data-testid="n8n-secret-input"
                  />
                  <Button variant="outline" size="icon" onClick={generateWebhookSecret} disabled={generating} title="Generate random secret">
                    <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  N8N webhook URL: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/n8n</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Set <code className="bg-muted px-1 py-0.5 rounded text-[11px]">Authorization: Bearer &lt;secret&gt;</code> in your N8N HTTP node.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Outbound Webhook URL <Badge variant="outline" className="ml-1 text-[10px]">optional</Badge></Label>
                <Input
                  type="url"
                  placeholder="https://your-n8n.instance/webhook/..."
                  value={n8nOutboundUrl}
                  onChange={(e) => setN8nOutboundUrl(e.target.value)}
                  data-testid="n8n-outbound-url-input"
                />
                <p className="text-xs text-muted-foreground">
                  Used when you click &quot;Send to N8N&quot; on a task card.
                </p>
              </div>

              <Button onClick={saveN8nSettings} disabled={saving} data-testid="save-n8n-settings-btn">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Your account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="profile-name-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={settings?.email ?? ""} disabled className="text-muted-foreground" />
              </div>
              <Button onClick={saveProfileSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
