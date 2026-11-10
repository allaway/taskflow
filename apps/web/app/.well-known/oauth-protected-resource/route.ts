import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/request-origin";

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * Claude fetches this to discover which authorization server handles this resource.
 */
export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  });
}
