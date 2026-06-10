/**
 * Next.js instrumentation hook — runs once when the server boots.
 * Validates required environment variables before serving traffic.
 * During `next build` we only warn so the build itself doesn't require secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateEnv } = await import("./lib/env");
  const { ok, errors } = validateEnv();
  if (ok) return;

  const message = `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.warn(`[env] ${message}`);
    return;
  }
  throw new Error(message);
}
