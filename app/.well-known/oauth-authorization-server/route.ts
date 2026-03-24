import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/request-origin";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Claude fetches this after discovering the authorization server via
 * /.well-known/oauth-protected-resource.
 */
export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/api/mcp/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: ["mcp"],
  });
}
