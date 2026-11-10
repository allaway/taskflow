"use client";
import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { MapPin, Video, X, Clock } from "lucide-react";
import type { CalendarEvent } from "@/app/api/calendar/events/route";

export function CalendarEventPopover({
  event,
  anchorPos,
  onClose,
}: {
  event: CalendarEvent;
  anchorPos: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const CARD_W = 280;
  const CARD_H = 240;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(anchorPos.x + 12, vw - CARD_W - 12);
  const top  = anchorPos.y + CARD_H > vh ? anchorPos.y - CARD_H - 8 : anchorPos.y + 8;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border border-border/60 bg-popover shadow-xl p-4 text-sm"
      style={{ left, top, width: CARD_W }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
          <span className="font-semibold leading-tight">{event.title}</span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Time */}
      {!event.allDay && (
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {format(new Date(event.start), "h:mm a")} – {format(new Date(event.end), "h:mm a")}
          </span>
        </div>
      )}

      {/* Calendar */}
      <div className="text-[11px] text-muted-foreground mb-2">{event.calendarName}</div>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-2 text-muted-foreground mb-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="text-xs break-words">{event.location}</span>
        </div>
      )}

      {/* Meet / video link */}
      {event.meetLink && (
        <a
          href={event.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mb-2 text-primary hover:underline font-medium"
        >
          <Video className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Join video call</span>
        </a>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-muted-foreground mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap border-t border-border/40 pt-2">
          {event.description}
        </p>
      )}
    </div>
  );
}
