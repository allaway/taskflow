"use client";
import { useEffect, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "calendar" | "list";

/** View mode for a page, remembered per browser. Starts as "calendar" until the saved choice is read. */
export function useViewMode(page: string): [ViewMode, (mode: ViewMode) => void] {
  const key = `taskflow_view_${page}`;
  const [mode, setMode] = useState<ViewMode>("calendar");

  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "list") setMode("list");
    } catch {
      // storage unavailable — keep the default
    }
  }, [key]);

  function update(next: ViewMode) {
    setMode(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // not remembered, still works for this visit
    }
  }
  return [mode, update];
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const options = [
    { value: "calendar" as const, label: "Calendar", icon: CalendarDays },
    { value: "list" as const, label: "List", icon: List },
  ];
  return (
    <div className="flex items-center rounded-md border border-border/60 p-0.5 shrink-0" role="group" aria-label="View">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          title={`${label} view`}
          data-testid={`view-${value}`}
          className={cn(
            "flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors",
            mode === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}
