import type { TaskLinkProvider } from "@prisma/client";

export interface ParsedLink {
  provider: TaskLinkProvider;
  externalKey: string;
  url: string;
}

const GITHUB_ISSUE_RE = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)/;
// Jira cloud issue URLs: https://org.atlassian.net/browse/PROJ-123
const JIRA_ISSUE_RE = /^https:\/\/([\w-]+\.atlassian\.net)\/browse\/([A-Z][A-Z0-9_]*-\d+)/i;

/** Classifies a URL into a TaskLink provider + canonical external key. */
export function parseLinkUrl(url: string): ParsedLink {
  const gh = url.match(GITHUB_ISSUE_RE);
  if (gh) {
    return { provider: "GITHUB", externalKey: `${gh[1]}/${gh[2]}#${gh[3]}`, url };
  }
  const jira = url.match(JIRA_ISSUE_RE);
  if (jira) {
    return { provider: "JIRA", externalKey: jira[2].toUpperCase(), url };
  }
  return { provider: "URL", externalKey: url, url };
}

export function parseGithubKey(externalKey: string): { owner: string; repo: string; number: number } | null {
  const m = externalKey.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}
