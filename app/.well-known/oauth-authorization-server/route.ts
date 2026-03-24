import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Required for MCP clients (like Claude Cowork) to discover the token endpoint.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    issuer: origin,
    token_endpoint: `${origin}/api/mcp/token`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  });
}
