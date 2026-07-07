import { NextResponse } from "next/server";
import { hasTargetTracks } from "@/lib/db";
import { importChannelVideos } from "@/lib/import";
import { TARGET_CHANNEL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/seed  →  대상(기본) 채널이 비어 있으면 최초 1회 자동 수집
export async function POST() {
  if (hasTargetTracks()) {
    return NextResponse.json({ seeded: false, reason: "already-seeded" });
  }

  try {
    const result = await importChannelVideos(TARGET_CHANNEL.url);
    return NextResponse.json({ seeded: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "대상 채널을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
