/**
 * Android contract tests for the Tasks API.
 *
 * These tests ensure that every response from the Tasks API matches the shape
 * the Android client parses. A failing test means a backend change would
 * silently break the mobile app.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AndroidTaskSchema, AndroidErrorResponseSchema } from "./contract.schemas";

// --- mocks (hoisted before imports) ---

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "@/app/api/tasks/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/tasks/[id]/route";

// --------------------------------------------------------------------------

const BASE_DATE = new Date("2024-01-01T00:00:00.000Z");
// Always in the future so CreateTaskSchema's futureDatetime refine passes
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

/** Exact shape Prisma returns for a Task row. */
const MOCK_TASK = {
  id: "clu_task_contract_001",
  title: "Contract test task",
  description: null as string | null,
  notes: null as string | null,
  status: "INBOX",
  priority: "MEDIUM",
  source: "MANUAL",
  scheduledDate: null as Date | null,
  startTime: null as string | null,
  duration: null as number | null,
  recurringRule: null as string | null,
  externalId: null as string | null,
  labels: null as string | null,
  userId: "clu_user_contract_001",
  completedAt: null as Date | null,
  daysOverdue: 0,
  agentQueued: false,
  createdAt: BASE_DATE,
  updatedAt: BASE_DATE,
};

const MOCK_SESSION = {
  user: { id: "clu_user_contract_001", email: "test@example.com" },
};

function makeReq(
  path: string,
  options?: { method?: string; body?: unknown }
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options?.method ?? "GET",
    ...(options?.body != null
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body),
        }
      : {}),
  });
}

function assertMatchesContract(data: unknown): void {
  const result = AndroidTaskSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Response violates Android Task contract:\n${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
}

// --------------------------------------------------------------------------

describe("GET /api/tasks — Android contract", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
  });

  it("returns a 200 array where each task matches the contract (empty fields null)", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([MOCK_TASK] as never);

    const res = await GET(makeReq("/api/tasks"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const task of body) assertMatchesContract(task);
  });

  it("returns a 200 array where each task matches the contract (all fields populated)", async () => {
    const fullTask = {
      ...MOCK_TASK,
      description: "A detailed description",
      notes: "Some notes",
      status: "SCHEDULED",
      priority: "HIGH",
      scheduledDate: FUTURE_DATE,
      startTime: "09:00",
      duration: 30,
      recurringRule: "0 9 * * 1",
      externalId: "notion-abc123",
      labels: '["work","urgent"]',
    };
    vi.mocked(prisma.task.findMany).mockResolvedValue([fullTask] as never);

    const res = await GET(makeReq("/api/tasks?status=SCHEDULED"));
    expect(res.status).toBe(200);

    const body = await res.json();
    for (const task of body) assertMatchesContract(task);
  });

  it("returns an empty array (not null/undefined) when no tasks exist", async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([] as never);

    const res = await GET(makeReq("/api/tasks"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 401 with { error } when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await GET(makeReq("/api/tasks"));
    expect(res.status).toBe(401);
    const body = await res.json();
    const result = AndroidErrorResponseSchema.safeParse(body);
    expect(result.success).toBe(true);
  });
});

// --------------------------------------------------------------------------

describe("POST /api/tasks — Android contract", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as never);
  });

  it("returns 201 with a Task body matching the contract on success", async () => {
    const createdTask = { ...MOCK_TASK, title: "New task from Android" };
    vi.mocked(prisma.task.create).mockResolvedValue(createdTask as never);

    const res = await POST(
      makeReq("/api/tasks", { method: "POST", body: { title: "New task from Android" } })
    );
    expect(res.status).toBe(201);
    assertMatchesContract(await res.json());
  });

  it("returns 201 with a scheduled task matching the contract", async () => {
    const scheduledTask = {
      ...MOCK_TASK,
      title: "Scheduled task",
      status: "SCHEDULED",
      scheduledDate: FUTURE_DATE,
      startTime: "14:00",
      duration: 60,
      priority: "HIGH",
    };
    vi.mocked(prisma.task.create).mockResolvedValue(scheduledTask as never);

    const res = await POST(
      makeReq("/api/tasks", {
        method: "POST",
        body: {
          title: "Scheduled task",
          scheduledDate: FUTURE_DATE.toISOString(),
          startTime: "14:00",
          duration: 60,
          priority: "HIGH",
        },
      })
    );
    expect(res.status).toBe(201);
    assertMatchesContract(await res.json());
  });

  it("returns 400 with { error } for invalid body", async () => {
    const res = await POST(
      makeReq("/api/tasks", { method: "POST", body: { title: "" } })
    );
    expect(res.status).toBe(400);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });

  it("returns 401 with { error } when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await POST(
      makeReq("/api/tasks", { method: "POST", body: { title: "Test" } })
    );
    expect(res.status).toBe(401);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });
});

// --------------------------------------------------------------------------

describe("GET /api/tasks/:id — Android contract", () => {
  const PARAMS = { params: Promise.resolve({ id: MOCK_TASK.id }) };

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as never);
  });

  it("returns 200 with a Task body matching the contract", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(MOCK_TASK as never);

    const res = await GET_ONE(makeReq(`/api/tasks/${MOCK_TASK.id}`), PARAMS);
    expect(res.status).toBe(200);
    assertMatchesContract(await res.json());
  });

  it("returns 404 with { error } when task not found", async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null as never);

    const res = await GET_ONE(makeReq(`/api/tasks/nonexistent`), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });
});

// --------------------------------------------------------------------------

describe("PATCH /api/tasks/:id — Android contract", () => {
  const PARAMS = { params: Promise.resolve({ id: MOCK_TASK.id }) };

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(MOCK_TASK as never);
  });

  it("returns 200 with updated Task matching the contract on status change", async () => {
    const completedTask = {
      ...MOCK_TASK,
      status: "COMPLETED",
      completedAt: FUTURE_DATE,
    };
    vi.mocked(prisma.task.update).mockResolvedValue(completedTask as never);

    const res = await PATCH(
      makeReq(`/api/tasks/${MOCK_TASK.id}`, {
        method: "PATCH",
        body: { status: "COMPLETED" },
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    assertMatchesContract(await res.json());
  });

  it("returns 200 with updated labels as JSON string matching the contract", async () => {
    const labelledTask = {
      ...MOCK_TASK,
      labels: '["work","urgent"]',
    };
    vi.mocked(prisma.task.update).mockResolvedValue(labelledTask as never);

    const res = await PATCH(
      makeReq(`/api/tasks/${MOCK_TASK.id}`, {
        method: "PATCH",
        body: { labels: ["work", "urgent"] },
      }),
      PARAMS
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    assertMatchesContract(body);
    // labels must be a JSON string, not a parsed array
    expect(typeof body.labels).toBe("string");
  });

  it("returns 400 with { error } for invalid body", async () => {
    const res = await PATCH(
      makeReq(`/api/tasks/${MOCK_TASK.id}`, {
        method: "PATCH",
        body: { priority: "CRITICAL" },
      }),
      PARAMS
    );
    expect(res.status).toBe(400);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });
});

// --------------------------------------------------------------------------

describe("DELETE /api/tasks/:id — Android contract", () => {
  const PARAMS = { params: Promise.resolve({ id: MOCK_TASK.id }) };

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as never);
    vi.mocked(prisma.task.findFirst).mockResolvedValue(MOCK_TASK as never);
    vi.mocked(prisma.task.delete).mockResolvedValue(MOCK_TASK as never);
  });

  it("returns 204 No Content with no body", async () => {
    const res = await DELETE(
      makeReq(`/api/tasks/${MOCK_TASK.id}`, { method: "DELETE" }),
      PARAMS
    );
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
  });
});
