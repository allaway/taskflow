import { NextRequest, NextResponse } from "next/server";
import { generateRecurringTasks } from "@/lib/recurring";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const created = await generateRecurringTasks();
  return NextResponse.json({ created });
}
