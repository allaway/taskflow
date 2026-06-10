import { describe, it, expect } from "vitest";
import { validateEnv, assertEnv } from "@/lib/env";

const VALID_ENV = {
  DATABASE_URL: "postgresql://localhost:5432/db",
  FIELD_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  NEXTAUTH_SECRET: "some-secret",
} as unknown as NodeJS.ProcessEnv;

describe("validateEnv", () => {
  it("accepts a valid environment", () => {
    expect(validateEnv(VALID_ENV).ok).toBe(true);
  });

  it("accepts AUTH_SECRET in place of NEXTAUTH_SECRET", () => {
    const env = { ...VALID_ENV, NEXTAUTH_SECRET: undefined, AUTH_SECRET: "x" } as unknown as NodeJS.ProcessEnv;
    expect(validateEnv(env).ok).toBe(true);
  });

  it("rejects a missing DATABASE_URL", () => {
    const env = { ...VALID_ENV, DATABASE_URL: undefined } as unknown as NodeJS.ProcessEnv;
    const result = validateEnv(env);
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain("DATABASE_URL");
  });

  it("rejects a malformed encryption key", () => {
    const env = { ...VALID_ENV, FIELD_ENCRYPTION_KEY: "tooshort" } as unknown as NodeJS.ProcessEnv;
    const result = validateEnv(env);
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain("FIELD_ENCRYPTION_KEY");
  });

  it("rejects when no auth secret is set", () => {
    const env = { ...VALID_ENV, NEXTAUTH_SECRET: undefined } as unknown as NodeJS.ProcessEnv;
    const result = validateEnv(env);
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain("NEXTAUTH_SECRET");
  });

  it("assertEnv throws a consolidated message", () => {
    const env = { ...VALID_ENV, DATABASE_URL: undefined, NEXTAUTH_SECRET: undefined } as unknown as NodeJS.ProcessEnv;
    expect(() => assertEnv(env)).toThrow(/DATABASE_URL[\s\S]*NEXTAUTH_SECRET/);
  });
});
