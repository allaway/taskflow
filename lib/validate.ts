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
    .regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM")
    .optional(),
  duration: z.number().int().min(5).max(480).optional(),
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
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  duration: z.number().int().min(5).max(480).optional().nullable(),
  recurringRule: z.string().max(100).optional().nullable(),
  labels: z.array(z.string().min(1).max(50)).optional().nullable(),
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
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  duration: z.number().int().min(5).max(480).optional(),
});

export const AiScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  workStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .default("09:00"),
  workEndTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .default("18:00"),
});

export const AiPromptSchema = z.object({
  taskId: z.string().cuid(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const CalendarFeedSchema = z.object({
  url: z.string().url().max(2000),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export const UserSettingsSchema = z.object({
  name: z.string().max(100).optional(),
  aiProvider: z.enum(["anthropic", "openrouter"]).optional(),
  aiApiKey: z.string().max(500).optional(),
  aiModel: z.string().max(200).optional(),
  aiSchedulingModel: z.string().max(200).optional(),
  calendarFeeds: z.array(CalendarFeedSchema).optional(),
  dailyBudgetHours: z.number().int().min(1).max(24).optional(),
  labelPalette: z.array(z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).optional(),
});

export type CalendarFeed = z.infer<typeof CalendarFeedSchema>;

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type WebhookTaskInput = z.infer<typeof WebhookTaskSchema>;
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
