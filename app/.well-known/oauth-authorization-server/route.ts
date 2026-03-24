import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/api/mcp/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
  });
}
