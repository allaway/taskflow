/**
 * Handing a task to Claude chat (claude.ai or the Claude desktop app).
 *
 * The chat opens with a prefilled prompt. Claude reads and reports on the task
 * through the TaskFlow connector, so the prompt stays short and carries ids
 * rather than everything in the task.
 */

const FIELD_LIMIT = 1200;

function clip(text: string): string {
  const t = text.trim();
  return t.length > FIELD_LIMIT ? `${t.slice(0, FIELD_LIMIT)}… (truncated; get_task has the rest)` : t;
}

export function buildClaudeHandoffPrompt(task: {
  id: string;
  title: string;
  priority: string;
  description: string | null;
  notes: string | null;
}): string {
  const lines = [
    "Please work on this task from TaskFlow, my task manager.",
    "",
    `**${task.title}** (priority: ${task.priority})`,
  ];
  if (task.description?.trim()) lines.push("", "Description:", clip(task.description));
  if (task.notes?.trim()) lines.push("", "Notes:", clip(task.notes));
  lines.push(
    "",
    `Use my TaskFlow connector. Task ID: ${task.id}`,
    "- Call get_task with that ID for the full, current details. Its `threads` list includes a thread for this conversation.",
    "- Report progress on that thread with post_thread_update. Set status WAITING if you need something from me, DONE when you finish.",
    "- Call complete_task once the work is done."
  );
  return lines.join("\n");
}

export function claudeWebUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

/** The Claude desktop app registers `claude://` and maps `claude://claude.ai/<path>` to that page. */
export function claudeAppUrl(prompt: string): string {
  return `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

/**
 * Opens the prompt in the Claude desktop app. A web page can't tell whether
 * the app is installed, so if this tab is still in front shortly afterwards
 * (nothing took focus), `onNoApp` runs so the caller can fall back to the web.
 */
export function openInClaudeApp(prompt: string, onNoApp: () => void, waitMs = 1800): void {
  let left = false;
  const mark = () => {
    left = true;
  };
  window.addEventListener("blur", mark, { once: true });
  document.addEventListener("visibilitychange", mark, { once: true });
  window.location.href = claudeAppUrl(prompt);
  window.setTimeout(() => {
    window.removeEventListener("blur", mark);
    document.removeEventListener("visibilitychange", mark);
    if (!left && document.visibilityState === "visible" && document.hasFocus()) onNoApp();
  }, waitMs);
}
