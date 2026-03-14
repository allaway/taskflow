import { describe, it, expect } from "vitest";
import {
  CreateTaskSchema,
  N8NWebhookSchema,
  UserSettingsSchema,
  LoginSchema,
} from "@/lib/validate";

describe("CreateTaskSchema", () => {
  it("accepts valid task", () => {
    const result = CreateTaskSchema.safeParse({ title: "Buy milk", priority: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = CreateTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title that is too long", () => {
    const result = CreateTaskSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = CreateTaskSchema.safeParse({ title: "Task", priority: "CRITICAL" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid startTime format", () => {
    const result = CreateTaskSchema.safeParse({ title: "Task", startTime: "9:00" });
    expect(result.success).toBe(false);
  });

  it("accepts valid startTime", () => {
    const result = CreateTaskSchema.safeParse({ title: "Task", startTime: "09:00" });
    expect(result.success).toBe(true);
  });
});

describe("N8NWebhookSchema", () => {
  it("accepts minimal valid payload", () => {
    const result = N8NWebhookSchema.safeParse({ title: "New ticket" });
    expect(result.success).toBe(true);
  });

  it("rejects oversized description", () => {
    const result = N8NWebhookSchema.safeParse({ title: "Task", description: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("accepts payload with externalId", () => {
    const result = N8NWebhookSchema.safeParse({ title: "Task", externalId: "notion-abc123" });
    expect(result.success).toBe(true);
  });
});

describe("UserSettingsSchema", () => {
  it("accepts partial updates", () => {
    const result = UserSettingsSchema.safeParse({ aiProvider: "anthropic", aiModel: "claude-opus-4-5" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid provider", () => {
    const result = UserSettingsSchema.safeParse({ aiProvider: "google" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid outbound URL", () => {
    const result = UserSettingsSchema.safeParse({ n8nOutboundUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for outbound URL (clear)", () => {
    const result = UserSettingsSchema.safeParse({ n8nOutboundUrl: "" });
    expect(result.success).toBe(true);
  });
});

describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    const result = LoginSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });
});
