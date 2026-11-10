"use client";
import { useEffect } from "react";

/**
 * Fires a background POST /api/calendar/sync on mount.
 * The sync endpoint skips if the DB was updated less than 15 minutes ago,
 * so this is cheap to call on every page load.
 */
export function CalendarSyncTrigger() {
  useEffect(() => {
    fetch("/api/calendar/sync", { method: "POST" }).catch(() => {/* silent */});
  }, []);

  return null;
}
