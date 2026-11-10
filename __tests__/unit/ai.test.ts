import { describe, it, expect } from "vitest";
import { buildAgentPromptRequest, resolveAiConfig } from "@/lib/ai";
import { encrypt } from "@/lib/crypto";

describe("buildAgentPromptRequest", () => {
  it("includes task title and priority", () => {
    const prompt = buildAgentPromptRequest({
      title: "Refactor auth module",
      description: "Split into smaller functions",
      notes: "Needs tests",
      priority: "HIGH",
    });
    expect(prompt).toContain("Refactor auth module");
    expect(prompt).toContain("HIGH");
  });

  it("includes optional notes", () => {
    const prompt = buildAgentPromptRequest({
      title: "Fix bug",
      description: null,
      notes: "See issue #123",
      priority: "MEDIUM",
    });
    expect(prompt).toContain("See issue #123");
  });

  it("instructs AI to generate a ready-to-paste prompt", () => {
    const prompt = buildAgentPromptRequest({ title: "Task", description: null, notes: null, priority: "LOW" });
    expect(prompt.toLowerCase()).toContain("prompt");
  });
});

describe("resolveAiConfig", () => {
  it("decrypts the API key correctly", () => {
    const rawKey = "sk-ant-test-key-12345";
    const encryptedKey = encrypt(rawKey);
    const config = resolveAiConfig({
      aiProvider: "anthropic",
      aiApiKey: encryptedKey,
      aiModel: "claude-opus-4-5",
      aiSchedulingModel: null,
    });
    expect(config.apiKey).toBe(rawKey);
    expect(config.model).toBe("claude-opus-4-5");
    expect(config.provider).toBe("anthropic");
  });

  it("uses scheduling model override when requested", () => {
    const rawKey = "sk-ant-test-key-12345";
    const encryptedKey = encrypt(rawKey);
    const config = resolveAiConfig(
      {
        aiProvider: "anthropic",
        aiApiKey: encryptedKey,
        aiModel: "claude-opus-4-5",
        aiSchedulingModel: "claude-haiku-3-5",
      },
      true
    );
    expect(config.model).toBe("claude-haiku-3-5");
  });

  it("throws when AI is not configured", () => {
    expect(() =>
      resolveAiConfig({ aiProvider: null, aiApiKey: null, aiModel: null, aiSchedulingModel: null })
    ).toThrow("AI provider not configured");
  });
});
