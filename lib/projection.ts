/**
 * Parallel time.
 *
 * A task marked `parallel` is worked on alongside other tasks (typically while
 * an agent is taking its turn). Parallel tasks whose times overlap cluster into
 * one block, so three one-hour parallel tasks started together occupy one hour
 * of the day rather than three.
 *
 * Pure functions only — shared by the timeline, the budget meter, the planner
 * and the tool layer.
 */

export const DEFAULT_DURATION = 30;

export interface ProjectableTask {
  id: string;
  startTime: string | null; // "HH:MM"
  duration: number | null; // minutes
  parallel: boolean;
}

export interface TimeBlock {
  /** Minutes since midnight; null for a block of untimed tasks. */
  start: number | null;
  end: number | null;
  /** Wall-clock minutes this block occupies. */
  minutes: number;
  taskIds: string[];
  parallel: boolean;
}

export interface DayProjection {
  blocks: TimeBlock[];
  /** Time the day actually takes: parallel clusters count once. */
  wallMinutes: number;
  /** Sum of every task's own estimate. */
  effortMinutes: number;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function projectDay(tasks: ProjectableTask[]): DayProjection {
  const blocks: TimeBlock[] = [];
  const dur = (t: ProjectableTask) => t.duration ?? DEFAULT_DURATION;

  // Sequential tasks each take their full estimate.
  for (const t of tasks) {
    if (t.parallel) continue;
    const start = t.startTime ? timeToMinutes(t.startTime) : null;
    blocks.push({
      start,
      end: start === null ? null : start + dur(t),
      minutes: dur(t),
      taskIds: [t.id],
      parallel: false,
    });
  }

  // Timed parallel tasks: merge overlapping intervals into clusters.
  const timed = tasks
    .filter((t) => t.parallel && t.startTime)
    .map((t) => ({ t, start: timeToMinutes(t.startTime!) }))
    .sort((a, b) => a.start - b.start);
  let current: TimeBlock | null = null;
  for (const { t, start } of timed) {
    const end = start + dur(t);
    if (current && start < current.end!) {
      current.end = Math.max(current.end!, end);
      current.minutes = current.end - current.start!;
      current.taskIds.push(t.id);
    } else {
      current = { start, end, minutes: end - start, taskIds: [t.id], parallel: true };
      blocks.push(current);
    }
  }

  // Untimed parallel tasks: assumed to run together, so the longest one sets the length.
  const untimed = tasks.filter((t) => t.parallel && !t.startTime);
  if (untimed.length > 0) {
    blocks.push({
      start: null,
      end: null,
      minutes: Math.max(...untimed.map(dur)),
      taskIds: untimed.map((t) => t.id),
      parallel: true,
    });
  }

  blocks.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));

  return {
    blocks,
    wallMinutes: blocks.reduce((acc, b) => acc + b.minutes, 0),
    effortMinutes: tasks.reduce((acc, t) => acc + dur(t), 0),
  };
}

export interface ColumnSlot {
  column: number;
  totalColumns: number;
}

/**
 * Side-by-side columns for timed tasks that overlap on the timeline, so a
 * parallel cluster renders as one block of time with its tasks next to each other.
 */
export function layoutColumns(tasks: ProjectableTask[]): Record<string, ColumnSlot> {
  const items = tasks
    .filter((t) => t.startTime)
    .map((t) => {
      const start = timeToMinutes(t.startTime!);
      return { id: t.id, start, end: start + (t.duration ?? DEFAULT_DURATION), column: 0 };
    })
    .sort((a, b) => a.start - b.start);

  const columnEnds: number[] = [];
  for (const item of items) {
    let col = columnEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[col] = item.end;
    }
    item.column = col;
  }

  const result: Record<string, ColumnSlot> = {};
  for (const item of items) {
    let maxCol = item.column;
    for (const other of items) {
      if (other !== item && other.start < item.end && other.end > item.start) {
        maxCol = Math.max(maxCol, other.column);
      }
    }
    result[item.id] = { column: item.column, totalColumns: maxCol + 1 };
  }
  return result;
}
