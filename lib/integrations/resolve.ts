import { prisma } from "@/lib/db";
import { decryptNullable } from "@/lib/crypto";
import { log } from "@/lib/logger";
import { closeGithubIssue } from "./github";
import { resolveJiraIssue } from "./jira";

export interface LinkSyncResult {
  linkId: string;
  provider: string;
  externalKey: string;
  ok: boolean;
  error?: string;
}

/**
 * Resolution sync: when a TaskFlow task is completed, close/resolve every
 * linked external item (GitHub issue, Jira issue) that has syncOnComplete set.
 * Failures are recorded on the link and reported, never thrown — completing
 * a task must not fail because an external tracker is unreachable.
 */
export async function syncLinksOnComplete(taskId: string, userId: string): Promise<LinkSyncResult[]> {
  const links = await prisma.taskLink.findMany({
    where: { taskId, syncOnComplete: true, provider: { in: ["GITHUB", "JIRA"] } },
  });
  if (links.length === 0) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubToken: true, jiraSiteUrl: true, jiraEmail: true, jiraApiToken: true },
  });
  if (!user) return [];

  const results: LinkSyncResult[] = [];

  for (const link of links) {
    let error: string | undefined;
    try {
      if (link.provider === "GITHUB") {
        const token = decryptNullable(user.githubToken);
        if (!token) throw new Error("No GitHub token configured in Settings → Integrations");
        await closeGithubIssue(link.externalKey, token);
      } else if (link.provider === "JIRA") {
        const apiToken = decryptNullable(user.jiraApiToken);
        if (!user.jiraSiteUrl || !user.jiraEmail || !apiToken) {
          throw new Error("Jira is not configured in Settings → Integrations");
        }
        await resolveJiraIssue(link.externalKey, {
          siteUrl: user.jiraSiteUrl,
          email: user.jiraEmail,
          apiToken,
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Sync failed";
    }

    await prisma.taskLink.update({
      where: { id: link.id },
      data: { lastSyncStatus: error ?? "ok", lastSyncedAt: new Date() },
    });

    if (error) {
      log.warn("link resolution sync failed", { taskId, linkId: link.id, provider: link.provider, error });
    } else {
      log.info("link resolved", { taskId, linkId: link.id, provider: link.provider, key: link.externalKey });
    }

    results.push({
      linkId: link.id,
      provider: link.provider,
      externalKey: link.externalKey,
      ok: !error,
      error,
    });
  }

  return results;
}
