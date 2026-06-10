interface JiraCredentials {
  siteUrl: string; // e.g. "https://yourorg.atlassian.net"
  email: string;
  apiToken: string;
}

interface JiraTransition {
  id: string;
  name: string;
  to?: { statusCategory?: { key?: string } };
}

function authHeader(creds: JiraCredentials): string {
  return `Basic ${Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64")}`;
}

/**
 * Transitions a Jira issue to its first "Done"-category status.
 * `issueKey` format: "PROJ-123".
 */
export async function resolveJiraIssue(issueKey: string, creds: JiraCredentials): Promise<void> {
  const base = creds.siteUrl.replace(/\/+$/, "");
  const headers = {
    Authorization: authHeader(creds),
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const listRes = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, { headers });
  if (!listRes.ok) {
    const msg =
      listRes.status === 401 ? "Jira credentials are invalid" :
      listRes.status === 404 ? `Jira issue ${issueKey} not found` :
      `Jira API error (${listRes.status})`;
    throw new Error(msg);
  }

  const { transitions = [] } = (await listRes.json()) as { transitions: JiraTransition[] };
  const done =
    transitions.find((t) => t.to?.statusCategory?.key === "done") ??
    transitions.find((t) => /^(done|resolve|close)/i.test(t.name));
  if (!done) {
    throw new Error(`No "Done" transition available for ${issueKey}`);
  }

  const doRes = await fetch(`${base}/rest/api/3/issue/${issueKey}/transitions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ transition: { id: done.id } }),
  });
  if (!doRes.ok) {
    throw new Error(`Failed to transition ${issueKey} (${doRes.status})`);
  }
}
