import { z } from "zod";

export const TaskStatusEnum = z.enum(["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"]);
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const TaskSourceEnum = z.enum(["MANUAL", "N8N", "RECURRING"]);

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  priority: PriorityEnum.optional().default("MEDIUM"),
  scheduledDate: z.string().datetime().optional(),
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
  scheduledDate: z.string().datetime().optional().nullable(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  duration: z.number().int().min(5).max(480).optional().nullable(),
  recurringRule: z.string().max(100).optional().nullable(),
});

export const N8NWebhookSchema = z.object({
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

export const UserSettingsSchema = z.object({
  name: z.string().max(100).optional(),
  n8nWebhookSecret: z.string().max(500).optional(),
  n8nOutboundUrl: z.string().url().max(2048).optional().or(z.literal("")),
  aiProvider: z.enum(["anthropic", "openrouter"]).optional(),
  aiApiKey: z.string().max(500).optional(),
  aiModel: z.string().max(200).optional(),
  aiSchedulingModel: z.string().max(200).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type N8NWebhookInput = z.infer<typeof N8NWebhookSchema>;
export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;
