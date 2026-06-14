/**
 * Canonical API contract for the Android client.
 *
 * These Zod schemas represent the exact JSON shape the Android app parses.
 * They are the single source of truth: the web tests verify the backend
 * satisfies them; the Android tests verify the Kotlin data classes satisfy them.
 *
 * Breaking change = schema parse fails = CI fails.
 */
import { z } from "zod";

const isoDatetime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
  "Must be a UTC ISO 8601 datetime (e.g. 2024-01-01T00:00:00.000Z)"
);

export const AndroidTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["INBOX", "SCHEDULED", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  source: z.enum(["MANUAL", "API", "RECURRING"]),
  scheduledDate: isoDatetime.nullable(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  duration: z.number().int().nullable(),
  recurringRule: z.string().nullable(),
  externalId: z.string().nullable(),
  /** JSON-encoded string array, e.g. '["work","urgent"]'. Parsed by Android. */
  labels: z.string().nullable(),
  userId: z.string().min(1),
  completedAt: isoDatetime.nullable(),
  daysOverdue: z.number().int().min(0),
  agentQueued: z.boolean(),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export const AndroidLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const AndroidRegisterResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
});

export const AndroidErrorResponseSchema = z.object({
  error: z.union([z.string(), z.record(z.unknown())]),
});

export type AndroidTask = z.infer<typeof AndroidTaskSchema>;
export type AndroidLabel = z.infer<typeof AndroidLabelSchema>;
