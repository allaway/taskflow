import { describe, it, expect } from "vitest";
import { layoutColumns, projectDay, formatMinutes } from "@/lib/projection";

const t = (id: string, startTime: string | null, duration: number | null, parallel = false) => ({
  id, startTime, duration, parallel,
});

describe("projectDay", () => {
  it("counts three one-hour parallel tasks started together as one hour", () => {
    const p = projectDay([t("a", "10:00", 60, true), t("b", "10:00", 60, true), t("c", "10:00", 60, true)]);
    expect(p.wallMinutes).toBe(60);
    expect(p.effortMinutes).toBe(180);
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0].taskIds).toEqual(["a", "b", "c"]);
  });

  it("sums sequential tasks in full", () => {
    const p = projectDay([t("a", "09:00", 60), t("b", "10:00", 30)]);
    expect(p.wallMinutes).toBe(90);
    expect(p.blocks).toHaveLength(2);
  });

  it("extends a cluster to the union of staggered parallel tasks", () => {
    const p = projectDay([t("a", "10:00", 60, true), t("b", "10:30", 60, true)]);
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0]).toMatchObject({ start: 600, end: 690, minutes: 90 });
  });

  it("keeps parallel tasks that do not overlap in separate blocks", () => {
    const p = projectDay([t("a", "09:00", 30, true), t("b", "14:00", 30, true)]);
    expect(p.blocks).toHaveLength(2);
    expect(p.wallMinutes).toBe(60);
  });

  it("does not let a sequential task share a parallel block", () => {
    const p = projectDay([t("a", "10:00", 60, true), t("b", "10:00", 60, true), t("c", "10:00", 60, false)]);
    expect(p.wallMinutes).toBe(120);
  });

  it("clusters untimed parallel tasks by the longest and defaults missing estimates to 30", () => {
    const p = projectDay([t("a", null, 45, true), t("b", null, null, true), t("c", null, null)]);
    expect(p.wallMinutes).toBe(45 + 30);
    expect(p.effortMinutes).toBe(45 + 30 + 30);
  });

  it("handles an empty day", () => {
    expect(projectDay([])).toEqual({ blocks: [], wallMinutes: 0, effortMinutes: 0 });
  });
});

describe("layoutColumns", () => {
  it("puts overlapping tasks side by side and leaves others full width", () => {
    const cols = layoutColumns([
      t("a", "10:00", 60, true), t("b", "10:00", 60, true), t("c", "13:00", 30), t("d", null, 30),
    ]);
    expect(cols.a).toEqual({ column: 0, totalColumns: 2 });
    expect(cols.b).toEqual({ column: 1, totalColumns: 2 });
    expect(cols.c).toEqual({ column: 0, totalColumns: 1 });
    expect(cols.d).toBeUndefined();
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});
