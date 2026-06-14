import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface LabelEntry { name: string; color: string; }

// Returns the user's label palette (all known labels + colors)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { labelPalette: true },
  });

  const palette: LabelEntry[] = user?.labelPalette ? JSON.parse(user.labelPalette) : [];
  return NextResponse.json(palette);
}
