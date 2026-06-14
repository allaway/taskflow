import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AiPromptSchema } from "@/lib/validate";
import { resolveAiConfig, callAi, buildAgentPromptRequest } from "@/lib/ai";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(getClientIp(req), "api");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = AiPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, userId: session.user.id },
    select: { title: true, description: true, notes: true, priority: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aiProvider: true, aiApiKey: true, aiModel: true, aiSchedulingModel: true },
  });

  let config;
  try {
    config = resolveAiConfig(user!);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI not configured";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const metaPrompt = buildAgentPromptRequest(task);

  let generatedPrompt: string;
  try {
    generatedPrompt = await callAi(config, metaPrompt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI call failed";
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ prompt: generatedPrompt.trim() });
}
