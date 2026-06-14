import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.cachedCalendarEvent.deleteMany({ where: { userId: session.user.id } }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken:  null,
        googleRefreshToken: null,
        googleTokenExpiry:  null,
        googleEmail:        null,
        calendarSyncedAt:   null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
