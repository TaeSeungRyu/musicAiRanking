import { NextResponse } from "next/server";
import { listChannels } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/channels  →  등록된 채널 목록 (영상 수 포함)
export async function GET() {
  return NextResponse.json({ channels: listChannels() });
}
