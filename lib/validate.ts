import { z } from "zod";

export const TaskStatusEnum = z.enum(["INBOX", "SCHEDULED", "NEEDS_REVIEW", "COMPLETED", "CANCELLED"]);
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
  recurringRule: z.string().max(100).optional(),
  projectId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
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
  projectId: z.string().cuid().optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  assignedAgent: z.enum(["in-app", "claude-code", "mcp"]).optional().nullable(),
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
  link: z.string().url().max(1000).optional(),
});

export const AiScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  workStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .default("09:00"),
  workEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .default("18:00"),
  timezone: z.string().optional().default("UTC"),
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
  githubToken: z.string().max(500).optional().nullable(),
  jiraSiteUrl: z.string().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
  jiraEmail: z.string().email().max(255).optional().nullable().or(z.literal("").transform(() => null)),
  jiraApiToken: z.string().max(500).optional().nullable(),
});

export const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  archived: z.boolean().optional(),
});

export const CommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const TaskLinkSchema = z.object({
  url: z.string().url().max(1000),
  syncOnComplete: z.boolean().optional().default(true),
});

export const BulkTaskActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  action: z.enum(["complete", "delete", "schedule", "inbox", "set_priority", "set_project", "delegate"]),
  scheduledDate: z.string().datetime().optional(),
  priority: PriorityEnum.optional(),
  projectId: z.string().cuid().optional().nullable(),
});

export const SessionReviewSchema = z.object({
  action: z.enum(["accept", "send_back"]),
  feedback: z.string().max(5000).optional(),
});

export const SessionAnswerSchema = z.object({
  answer: z.string().min(1).max(5000),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type WebhookTaskInput = z.infer<typeof WebhookTaskSchema>;
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
