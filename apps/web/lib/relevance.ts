/**
 * Catch-up relevance. A cheap, deterministic score that works with no AI
 * configured; the AI re-rank (lib/services/catchup.ts) refines it when available.
 */

const STOPWORDS = new Set([
  "about", "after", "again", "also", "been", "before", "being", "could", "does", "done",
  "from", "have", "into", "just", "more", "need", "next", "only", "over", "review",
  "send", "should", "some", "task", "than", "that", "their", "them", "then", "there",
  "these", "this", "today", "update", "what", "when", "will", "with", "work", "would", "your",
]);

const SOURCE_BASE: Record<string, number> = {
  agent: 65,
  email: 45,
  slack: 45,
  calendar: 40,
};

export function extractKeywords(texts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length >= 4 && !STOPWORDS.has(word)) out.add(word);
    }
  }
  return out;
}

export interface ScorableItem {
  source: string;
  title: string;
  body?: string | null;
  author?: string | null;
}

export function scoreItem(
  item: ScorableItem,
  keywords: Set<string>
): { relevance: number; reason: string | null } {
  const base = SOURCE_BASE[item.source.toLowerCase()] ?? 35;
  const words = extractKeywords([item.title, item.body, item.author]);
  const hits = [...words].filter((w) => keywords.has(w));
  const relevance = Math.min(100, base + Math.min(hits.length, 4) * 12);
  const reason =
    hits.length > 0
      ? `Mentions ${hits.slice(0, 3).join(", ")} from your current work`
      : item.source.toLowerCase() === "agent"
        ? "Update from an agent thread"
        : null;
  return { relevance, reason };
}
