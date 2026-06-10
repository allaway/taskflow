import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/agentSessions";

describe("agent session state machine", () => {
  it("allows the happy path: PENDING → ACTIVE → NEEDS_REVIEW → COMPLETE", () => {
    expect(canTransition("PENDING", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "NEEDS_REVIEW")).toBe(true);
    expect(canTransition("NEEDS_REVIEW", "COMPLETE")).toBe(true);
  });

  it("allows elicitation round-trips", () => {
    expect(canTransition("ACTIVE", "AWAITING_INPUT")).toBe(true);
    expect(canTransition("AWAITING_INPUT", "ACTIVE")).toBe(true);
  });

  it("allows send-back from review", () => {
    expect(canTransition("NEEDS_REVIEW", "ACTIVE")).toBe(true);
  });

  it("allows stale sessions to recover or fail", () => {
    expect(canTransition("ACTIVE", "STALE")).toBe(true);
    expect(canTransition("STALE", "ACTIVE")).toBe(true);
    expect(canTransition("STALE", "ERROR")).toBe(true);
  });

  it("forbids skipping the review gate", () => {
    expect(canTransition("PENDING", "COMPLETE")).toBe(false);
    expect(canTransition("ACTIVE", "COMPLETE")).toBe(false);
    expect(canTransition("AWAITING_INPUT", "COMPLETE")).toBe(false);
  });

  it("treats COMPLETE and ERROR as terminal", () => {
    expect(canTransition("COMPLETE", "ACTIVE")).toBe(false);
    expect(canTransition("ERROR", "ACTIVE")).toBe(false);
  });
});
