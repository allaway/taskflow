import { randomBytes } from "crypto";

/**
 * Minimal structured JSON logger for API routes.
 * One line per event: {"ts","level","msg","requestId",...fields}
 */

type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

export function newRequestId(): string {
  return randomBytes(6).toString("hex");
}

/** Returns a logger that stamps every line with the same requestId. */
export function requestLogger(route: string) {
  const requestId = newRequestId();
  const base = { requestId, route };
  return {
    requestId,
    info: (msg: string, fields?: LogFields) => emit("info", msg, { ...base, ...fields }),
    warn: (msg: string, fields?: LogFields) => emit("warn", msg, { ...base, ...fields }),
    error: (msg: string, fields?: LogFields) => emit("error", msg, { ...base, ...fields }),
  };
}
