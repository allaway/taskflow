import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

/**
 * Resolves an `Authorization: Bearer tf_…` API token to its user id.
 * Shared by the MCP endpoint and the webhooks.
 */
export async function userIdFromBearer(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const record = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });
  if (!record) return null;
  // Don't block the request on bookkeeping.
  prisma.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return record.userId;
}
