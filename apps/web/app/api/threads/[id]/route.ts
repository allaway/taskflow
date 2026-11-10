import { NextRequest, NextResponse } from "next/server";
import { UpdateThreadSchema } from "@/lib/validate";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { deleteThread, getThread, updateThread } from "@/lib/services/threads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await getThread(userId, (await params).id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const parsed = UpdateThreadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateThread(userId, (await params).id, parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  try {
    await deleteThread(userId, (await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
