/**
 * Android contract tests for the Labels API.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AndroidLabelSchema, AndroidErrorResponseSchema } from "./contract.schemas";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/labels/route";

const MOCK_SESSION = {
  user: { id: "clu_user_contract_001", email: "test@example.com" },
};

function assertLabelArray(body: unknown): void {
  if (!Array.isArray(body)) throw new Error("Response must be an array");
  for (const label of body) {
    const result = AndroidLabelSchema.safeParse(label);
    if (!result.success) {
      throw new Error(
        `Label violates Android contract:\n${JSON.stringify(result.error.issues, null, 2)}`
      );
    }
  }
}

describe("GET /api/labels — Android contract", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue(MOCK_SESSION as never);
  });

  it("returns 200 array of labels matching the contract", async () => {
    const palette = [
      { name: "work", color: "#6366f1" },
      { name: "personal", color: "#f59e0b" },
    ];
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      labelPalette: JSON.stringify(palette),
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    assertLabelArray(body);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ name: "work", color: "#6366f1" });
  });

  it("returns 200 with an empty array (not null) when palette is not set", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      labelPalette: null,
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it("label color is always a 7-character hex string (#RRGGBB)", async () => {
    const palette = [{ name: "tag", color: "#ff0000" }];
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      labelPalette: JSON.stringify(palette),
    } as never);

    const res = await GET();
    const body = await res.json();
    assertLabelArray(body);
    expect(body[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("returns 401 with { error } when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const res = await GET();
    expect(res.status).toBe(401);
    const result = AndroidErrorResponseSchema.safeParse(await res.json());
    expect(result.success).toBe(true);
  });
});
