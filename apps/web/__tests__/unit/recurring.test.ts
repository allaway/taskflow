import { describe, it, expect } from "vitest";
import { getNextOccurrences } from "@/lib/recurring";
import { startOfDay } from "date-fns";

const monday = new Date("2025-01-06"); // Known Monday

describe("getNextOccurrences", () => {
  it("returns daily occurrences", () => {
    const dates = getNextOccurrences("DAILY", monday, 3);
    expect(dates).toHaveLength(3);
    const expected = [
      startOfDay(new Date("2025-01-07")),
      startOfDay(new Date("2025-01-08")),
      startOfDay(new Date("2025-01-09")),
    ];
    expect(dates.map((d) => d.toISOString())).toEqual(expected.map((d) => d.toISOString()));
  });

  it("returns weekly occurrences by day number (1=Monday)", () => {
    const dates = getNextOccurrences("WEEKLY:1", monday, 3);
    expect(dates).toHaveLength(3);
    dates.forEach((d) => expect(d.getDay()).toBe(1));
  });

  it("returns weekly occurrences by day name", () => {
    const dates = getNextOccurrences("WEEKLY:MON", monday, 2);
    expect(dates).toHaveLength(2);
    dates.forEach((d) => expect(d.getDay()).toBe(1));
  });

  it("returns weekly Friday occurrences", () => {
    const dates = getNextOccurrences("WEEKLY:FRI", monday, 1);
    expect(dates[0].getDay()).toBe(5);
  });

  it("returns empty array for unknown rule", () => {
    const dates = getNextOccurrences("MONTHLY:1", monday, 3);
    expect(dates).toHaveLength(0);
  });

  it("does not include the start date itself", () => {
    const dates = getNextOccurrences("DAILY", monday, 1);
    const mondayStart = startOfDay(monday);
    expect(dates[0].toISOString()).not.toBe(mondayStart.toISOString());
  });
});
