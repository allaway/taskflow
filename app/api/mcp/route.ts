/**
 * MCP HTTP endpoint — implements the MCP streamable-HTTP transport (JSON-RPC 2.0).
 * Claude Code connects to this URL with:
 *   { "type": "http", "url": "https://…/api/mcp", "headers": { "Authorization": "Bearer tf_…" } }
 *
 * The tools themselves live in lib/tools/registry.ts and are shared with the
 * in-app assistant.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { userIdFromBearer } from "@/lib/apiAuth";
import { getOrigin } from "@/lib/request-origin";
import { TOOLS, callTool } from "@/lib/tools/registry";

type RpcMessage = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

async function handleMessage(msg: RpcMessage, userId: string) {
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "taskflow", version: "2.0.0" },
      },
    };
  }

  if (method === "notifications/initialized" || isNotification) {
    return null; // notifications get no response
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      },
    };
  }

  if (method === "tools/call") {
    try {
      const result = await callTool(String(params.name), params.arguments ?? {}, { userId });
      return {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

function unauthorized(req: NextRequest) {
  const origin = getOrigin(req);
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return unauthorized(req);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support both single messages and batches
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((msg: RpcMessage) => handleMessage(msg, userId))
    );
    const filtered = responses.filter(Boolean);
    if (filtered.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(filtered);
  }

  const response = await handleMessage(body as RpcMessage, userId);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

// GET is required by the streamable HTTP spec (even if we don't support SSE streaming)
export async function GET(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return unauthorized(req);
  return NextResponse.json({ error: "SSE streaming not supported; use POST" }, { status: 405 });
}
