import { describe, it, expect } from "vitest";
import { parseLinkUrl, parseGithubKey } from "@/lib/integrations/links";

describe("parseLinkUrl", () => {
  it("classifies GitHub issue URLs", () => {
    const parsed = parseLinkUrl("https://github.com/allaway/taskflow/issues/42");
    expect(parsed.provider).toBe("GITHUB");
    expect(parsed.externalKey).toBe("allaway/taskflow#42");
  });

  it("classifies GitHub PR URLs", () => {
    const parsed = parseLinkUrl("https://github.com/org/some-repo.name/pull/7");
    expect(parsed.provider).toBe("GITHUB");
    expect(parsed.externalKey).toBe("org/some-repo.name#7");
  });

  it("classifies Jira cloud issue URLs", () => {
    const parsed = parseLinkUrl("https://myorg.atlassian.net/browse/PROJ-123");
    expect(parsed.provider).toBe("JIRA");
    expect(parsed.externalKey).toBe("PROJ-123");
  });

  it("normalizes lowercase Jira keys", () => {
    const parsed = parseLinkUrl("https://myorg.atlassian.net/browse/proj-9");
    expect(parsed.provider).toBe("JIRA");
    expect(parsed.externalKey).toBe("PROJ-9");
  });

  it("falls back to URL provider for everything else", () => {
    const parsed = parseLinkUrl("https://example.com/some/doc");
    expect(parsed.provider).toBe("URL");
    expect(parsed.externalKey).toBe("https://example.com/some/doc");
  });

  it("does not treat github.com profile URLs as issues", () => {
    expect(parseLinkUrl("https://github.com/allaway").provider).toBe("URL");
    expect(parseLinkUrl("https://github.com/allaway/taskflow").provider).toBe("URL");
  });
});

describe("parseGithubKey", () => {
  it("round-trips a parsed key", () => {
    expect(parseGithubKey("owner/repo#15")).toEqual({ owner: "owner", repo: "repo", number: 15 });
  });

  it("rejects malformed keys", () => {
    expect(parseGithubKey("not-a-key")).toBeNull();
    expect(parseGithubKey("owner/repo#abc")).toBeNull();
  });
});
