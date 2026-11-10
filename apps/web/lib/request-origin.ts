import type { NextRequest } from "next/server";

/**
 * Returns the public-facing origin of the request.
 * Railway (and most reverse proxies) set X-Forwarded-Host/Proto headers.
 * Falling back to req.url.origin picks up the internal 0.0.0.0:8080 address
 * which breaks OAuth discovery.
 */
export function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host") ??
    new URL(req.url).host;
  return `${proto}://${host}`;
}
