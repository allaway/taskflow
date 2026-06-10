import { z } from "zod";

/**
 * Server environment validation — fail fast at startup with a readable
 * message instead of crashing later on first use (e.g. first encrypt() call).
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FIELD_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "FIELD_ENCRYPTION_KEY must be a 64-character hex string. Generate with: openssl rand -hex 32"
    ),
  NEXTAUTH_URL: z.string().url().optional(),
  // Optional integrations / operational secrets
  ALLOWED_REGISTRATION_EMAILS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type ValidatedEnv = z.infer<typeof EnvSchema>;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  // NextAuth accepts either name; require at least one.
  if (!env.NEXTAUTH_SECRET && !env.AUTH_SECRET) {
    errors.push("NEXTAUTH_SECRET (or AUTH_SECRET) is required. Generate with: openssl rand -base64 32");
  }

  return { ok: errors.length === 0, errors };
}

/** Throws with a consolidated message listing every missing/invalid variable. */
export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const { ok, errors } = validateEnv(env);
  if (!ok) {
    throw new Error(
      `Invalid server environment:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
}
