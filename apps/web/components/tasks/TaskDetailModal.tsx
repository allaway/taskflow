"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, Tag } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@prisma/client";

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColor = {
  HIGH:   "bg-rose-500/15 text-rose-400 border-rose-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW:    "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const sourceColor = {
  API:       "bg-violet-500/15 text-violet-400 border-violet-500/30",
  RECURRING: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  MANUAL:    "bg-muted text-muted-foreground border-border",
};

export function TaskDetailModal({ task, open, onOpenChange }: TaskDetailModalProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-6">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md border", priorityColor[task.priority])}>
              {task.priority.toLowerCase()} priority
            </span>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-md border", sourceColor[task.source])}>
              {task.source.toLowerCase()}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-muted text-muted-foreground border-border">
              {task.status.toLowerCase()}
            </span>
          </div>

          {/* Schedule info */}
          {(task.scheduledDate || task.startTime) && (
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {task.scheduledDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(task.scheduledDate), "EEE, MMM d yyyy")}
                </span>
              )}
              {task.startTime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {task.startTime}
                  {task.duration && <span className="text-muted-foreground/60">· {task.duration}m</span>}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.notes}</p>
            </div>
          )}

          {/* External ID */}
          {task.externalId && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Tag className="h-3 w-3" />
              <span className="font-mono">{task.externalId}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
