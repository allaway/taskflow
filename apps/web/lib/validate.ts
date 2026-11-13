import { z } from "zod";

export const TaskStatusEnum = z.enum(["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"]);
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const TaskSourceEnum = z.enum(["MANUAL", "API", "RECURRING"]);

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const futureDatetime = z
  .string()
  .datetime()
  .refine(
    (val) => new Date(val) >= startOfTodayUTC(),
    "Cannot schedule a task in the past"
  );

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  priority: PriorityEnum.optional().default("MEDIUM"),
  scheduledDate: futureDatetime.optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be HH:MM")
    .optional(),
  duration: z.number().int().min(5).max(480).optional(),
  parallel: z.boolean().optional(),
  recurringRule: z.string().max(100).optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  priority: PriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
  scheduledDate: futureDatetime.optional().nullable(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  duration: z.number().int().min(5).max(480).optional().nullable(),
  recurringRule: z.string().max(100).optional().nullable(),
  labels: z.array(z.string().min(1).max(50)).optional().nullable(),
  agentQueued: z.boolean().optional(),
  parallel: z.boolean().optional(),
});

export const WebhookTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  priority: PriorityEnum.optional().default("MEDIUM"),
  externalId: z.string().max(255).optional(),
  scheduledDate: z.string().datetime().optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  duration: z.number().int().min(5).max(480).optional(),
});

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM");

export const PlanRequestSchema = z.object({
  date: Day,
  intent: z.string().max(2000).optional().default(""),
  workStartTime: Time.optional().default("09:00"),
  workEndTime: Time.optional().default("18:00"),
  timezone: z.string().max(100).optional().default("UTC"),
});

export const PlanApplySchema = z.object({
  date: Day,
  scheduledDate: z.string().datetime(),
  intent: z.string().max(2000).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        taskId: z.string().min(1),
        startTime: Time,
        duration: z.number().int().min(5).max(480),
        parallel: z.boolean().optional().default(false),
      })
    )
    .max(100),
  newTasks: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        startTime: Time.nullable().optional().default(null),
        duration: z.number().int().min(5).max(480),
        parallel: z.boolean().optional().default(false),
        priority: PriorityEnum.optional().default("MEDIUM"),
      })
    )
    .max(10)
    .optional()
    .default([]),
});

export const AssistantMessageSchema = z.object({
  date: Day,
  timezone: z.string().max(100).optional().default("UTC"),
  content: z.string().min(1).max(10000),
});

export const ThreadStatusEnum = z.enum(["ACTIVE", "WAITING", "DONE"]);

export const CreateThreadSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().max(300).optional(),
  provider: z.string().min(1).max(40).optional().default("taskflow"),
  url: z.string().url().max(2000).optional(),
});

export const UpdateThreadSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  url: z.string().url().max(2000).nullable().optional(),
  status: ThreadStatusEnum.optional(),
  summary: z.string().max(500).nullable().optional(),
});

export const ThreadMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  timezone: z.string().max(100).optional(),
});

export const CatchUpItemSchema = z.object({
  source: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  body: z.string().max(20000).optional().nullable(),
  url: z.string().url().max(2000).optional().nullable(),
  author: z.string().max(200).optional().nullable(),
  externalId: z.string().max(255).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
});

export const CatchUpWebhookSchema = z.union([
  CatchUpItemSchema,
  z.object({ items: z.array(CatchUpItemSchema).min(1).max(50) }),
]);

export const CatchUpTriageSchema = z.object({
  action: z.enum(["task", "archive", "restore", "complete"]),
});

export const AiPromptSchema = z.object({
  taskId: z.string().cuid(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const UserSettingsSchema = z.object({
  name: z.string().max(100).optional(),
  aiProvider: z.enum(["anthropic", "openrouter"]).optional(),
  aiApiKey: z.string().max(500).optional(),
  aiModel: z.string().max(200).optional(),
  aiSchedulingModel: z.string().max(200).optional(),
  dailyBudgetHours: z.number().int().min(1).max(24).optional(),
  labelPalette: z.array(z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).optional(),
  claudeCodeRoutineId: z.string().max(200).optional().nullable(),
  claudeCodeRoutineToken: z.string().max(500).optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type WebhookTaskInput = z.infer<typeof WebhookTaskSchema>;
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
