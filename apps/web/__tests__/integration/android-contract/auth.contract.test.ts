/**
 * Android contract tests for the Auth API.
 *
 * Covers the register endpoint (the only unauthenticated JSON endpoint
 * the Android client calls for account creation).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AndroidRegisterResponseSchema, AndroidErrorResponseSchema } from "./contract.schemas";

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/auth/register/route";

const CREATED_DATE = new Date("2024-01-01T00:00:00.000Z");

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register — Android contract", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "clu_user_new_001",
      email: "newuser@example.com",
      name: "New User",
      createdAt: CREATED_DATE,
      updatedAt: CREATED_DATE,
    } as never);
  });

  it("returns 201 with { id, email, name } matching the contract", async () => {
    const res = await POST(
      makeReq({ name: "New User", email: "newuser@example.com", password: "password123" })
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    const result = AndroidRegisterResponseSchema.safeParse(body);
    if (!result.success) {
      throw new Error(
        `Register response violates Android contract:\n${JSON.stringify(result.error.issues, null, 2)}`
      );
    }
  });

  it("register response does NOT include passwordHash", async () => {
    const res = await POST(
      makeReq({ name: "User", email: "user@example.com", password: "password123" })
    );
    const body = await res.json();
    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 400 with { error } for short password", async () => {
    const res = await POST(
      makeReq({ name: "User", email: "user@example.com", password: "short" })
    );
    expect(res.status).toBe(400);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });

  it("returns 400 with { error } for invalid email", async () => {
    const res = await POST(
      makeReq({ name: "User", email: "not-an-email", password: "password123" })
    );
    expect(res.status).toBe(400);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });

  it("returns 400 with { error } for missing name", async () => {
    const res = await POST(
      makeReq({ email: "user@example.com", password: "password123" })
    );
    expect(res.status).toBe(400);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });

  it("returns 409 with { error } when email already in use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing",
    } as never);

    const res = await POST(
      makeReq({ name: "User", email: "existing@example.com", password: "password123" })
    );
    expect(res.status).toBe(409);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });
});
