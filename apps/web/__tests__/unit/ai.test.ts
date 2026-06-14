import { describe, it, expect } from "vitest";
import { buildSchedulePrompt, buildAgentPromptRequest, resolveAiConfig } from "@/lib/ai";
import { encrypt } from "@/lib/crypto";

describe("buildSchedulePrompt", () => {
  const tasks = [
    { id: "task1", title: "Write tests", description: null, priority: "HIGH" as const, duration: 60 },
    { id: "task2", title: "Review PR", description: "Check the auth changes", priority: "MEDIUM" as const, duration: 30 },
  ];

  it("includes task IDs and titles", () => {
    const prompt = buildSchedulePrompt(tasks, "2025-01-06", "09:00", "18:00");
    expect(prompt).toContain("task1");
    expect(prompt).toContain("Write tests");
    expect(prompt).toContain("task2");
    expect(prompt).toContain("Review PR");
  });

  it("includes the date and working hours", () => {
    const prompt = buildSchedulePrompt(tasks, "2025-01-06", "09:00", "17:00");
    expect(prompt).toContain("2025-01-06");
    expect(prompt).toContain("09:00");
    expect(prompt).toContain("17:00");
  });

  it("requests JSON array output", () => {
    const prompt = buildSchedulePrompt(tasks, "2025-01-06", "09:00", "18:00");
    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("taskId");
    expect(prompt).toContain("startTime");
  });
});

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
