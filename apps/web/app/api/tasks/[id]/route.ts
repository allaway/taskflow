import { NextRequest, NextResponse } from "next/server";
import { UpdateTaskSchema } from "@/lib/validate";
import { errorResponse, sessionUserId, unauthorized } from "@/lib/http";
import { deleteTask, getTask, updateTask } from "@/lib/services/tasks";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await getTask(userId, (await params).id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateTask(userId, (await params).id, parsed.data));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  try {
    await deleteTask(userId, (await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
