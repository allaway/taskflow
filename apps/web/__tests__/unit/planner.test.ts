import { describe, it, expect } from "vitest";
import { buildPlanPrompt, fallbackPlan, parsePlan, toLocalHHMM, type PlanContext } from "@/lib/services/planner";

const task = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, title, description: null, priority: "MEDIUM" as const, duration: 60,
  startTime: null, parallel: false, daysOverdue: 0, ...over,
});

const ctx: PlanContext = {
  date: "2026-11-10",
  workStart: "09:00",
  workEnd: "17:00",
  budgetHours: 6,
  dayTasks: [task("day1", "Finish report")],
  inboxTasks: [task("in1", "Review PR", { priority: "HIGH", duration: 30 }), task("in2", "Tidy notes", { priority: "LOW" })],
  meetings: [{ start: "09:30", end: "10:00", title: "Standup" }],
  threads: [{ title: "Refactor auth", status: "WAITING", taskId: "day1", taskTitle: "Finish report", summary: "Needs a decision" }],
  catchUp: [{ source: "email", title: "Budget question" }],
  previousIntent: "Ship the migration",
};

describe("buildPlanPrompt", () => {
  const prompt = buildPlanPrompt(ctx, "Get the report drafted");

  it("leads with the user's intent and includes every context source", () => {
    expect(prompt).toContain("Get the report drafted");
    expect(prompt).toContain("2026-11-10");
    expect(prompt).toContain("09:30–10:00 Standup");
    expect(prompt).toContain('[day1] "Finish report"');
    expect(prompt).toContain('[in1] "Review PR"');
    expect(prompt).toContain('"Refactor auth" is waiting on them');
    expect(prompt).toContain("(email) Budget question");
    expect(prompt).toContain("Ship the migration");
  });

  it("explains parallel time and asks for JSON", () => {
    expect(prompt).toContain('"parallel": true');
    expect(prompt).toContain('"schedule"');
    expect(prompt).toContain('"newTasks"');
  });

  it("marks empty sections rather than omitting them", () => {
    const empty = buildPlanPrompt({ ...ctx, meetings: [], threads: [], catchUp: [], previousIntent: null }, "");
    expect(empty).toContain("(none)");
    expect(empty).toContain("They didn't say");
  });
});

describe("parsePlan", () => {
  const ids = new Set(["day1", "in1"]);

  it("parses a fenced reply and sorts by start time", () => {
    const raw = '```json\n{"summary":"Report first.","schedule":[{"taskId":"in1","startTime":"13:00","duration":30,"parallel":true},{"taskId":"day1","startTime":"10:10","duration":90,"parallel":false}],"newTasks":[]}\n```';
    const plan = parsePlan(raw, ids);
    expect(plan.summary).toBe("Report first.");
    expect(plan.items.map((i) => i.taskId)).toEqual(["day1", "in1"]);
    expect(plan.items[1].parallel).toBe(true);
  });

  it("drops unknown ids, duplicates and malformed times", () => {
    const plan = parsePlan(
      JSON.stringify({
        schedule: [
          { taskId: "nope", startTime: "09:00", duration: 30 },
          { taskId: "day1", startTime: "9am", duration: 30 },
          { taskId: "in1", startTime: "09:00", duration: 30 },
          { taskId: "in1", startTime: "11:00", duration: 30 },
        ],
      }),
      ids
    );
    expect(plan.items).toEqual([{ taskId: "in1", startTime: "09:00", duration: 30, parallel: false }]);
    expect(plan.summary).toBe("");
  });

  it("clamps durations and caps new tasks at three", () => {
    const plan = parsePlan(
      JSON.stringify({
        schedule: [{ taskId: "day1", startTime: "09:00", duration: 9999 }],
        newTasks: [1, 2, 3, 4].map((n) => ({ title: `New ${n}`, duration: 1, priority: "URGENT" })),
      }),
      ids
    );
    expect(plan.items[0].duration).toBe(480);
    expect(plan.newTasks).toHaveLength(3);
    expect(plan.newTasks[0]).toEqual({ title: "New 1", startTime: null, duration: 5, parallel: false, priority: "MEDIUM" });
  });

  it("throws when there is no JSON object", () => {
    expect(() => parsePlan("Sorry, I can't.", ids)).toThrow();
  });
});

describe("fallbackPlan", () => {
  it("schedules day tasks and high-priority inbox tasks around meetings", () => {
    const plan = fallbackPlan(ctx);
    // 09:00 + 60m would run into the 09:30 standup, so it starts after it.
    expect(plan.items).toEqual([
      { taskId: "day1", startTime: "10:10", duration: 60, parallel: false },
      { taskId: "in1", startTime: "11:20", duration: 30, parallel: false },
    ]);
  });

  it("stops at the daily budget", () => {
    const plan = fallbackPlan({ ...ctx, budgetHours: 1 });
    expect(plan.items.map((i) => i.taskId)).toEqual(["day1"]);
  });
});

describe("toLocalHHMM", () => {
  it("converts to the given timezone and falls back to UTC on a bad one", () => {
    const d = new Date("2026-11-10T17:30:00Z");
    expect(toLocalHHMM(d, "America/Los_Angeles")).toBe("09:30");
    expect(toLocalHHMM(d, "Not/AZone")).toBe("17:30");
    expect(toLocalHHMM(new Date("2026-11-10T08:05:00Z"), "America/Los_Angeles")).toBe("00:05");
  });
});
