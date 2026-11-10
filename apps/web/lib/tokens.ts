import { createHash, randomBytes } from "crypto";

export function generateToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const raw = randomBytes(32).toString("hex");
  const token = `tf_${raw}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = `tf_${raw.slice(0, 8)}…`;
  return { token, tokenHash, tokenPrefix };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
