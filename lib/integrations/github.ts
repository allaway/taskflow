import { parseGithubKey } from "./links";

const GITHUB_API = "https://api.github.com";

/**
 * Closes a linked GitHub issue (or PR) as completed.
 * `externalKey` format: "owner/repo#123".
 */
export async function closeGithubIssue(externalKey: string, token: string): Promise<void> {
  const parsed = parseGithubKey(externalKey);
  if (!parsed) throw new Error(`Invalid GitHub link key: ${externalKey}`);

  // The issues endpoint also closes PRs — PRs are issues in the REST API.
  const res = await fetch(
    `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: "closed", state_reason: "completed" }),
    }
  );

  if (!res.ok) {
    const msg =
      res.status === 401 ? "GitHub token is invalid or expired" :
      res.status === 403 ? "GitHub token lacks permission to close this issue" :
      res.status === 404 ? "GitHub issue not found (check repo access)" :
      `GitHub API error (${res.status})`;
    throw new Error(msg);
  }
}
