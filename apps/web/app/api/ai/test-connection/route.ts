import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { testAiConnection } from "@/lib/ai";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const TestSchema = z.object({
  provider: z.enum(["anthropic", "openrouter"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = TestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const success = await testAiConnection(parsed.data);
  return NextResponse.json({ success });
}
