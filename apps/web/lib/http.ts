import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ServiceError } from "@/lib/services/tasks";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** The signed-in user's id, or null. */
export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Maps a thrown error to a JSON response; service errors keep their status. */
export function errorResponse(err: unknown) {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
