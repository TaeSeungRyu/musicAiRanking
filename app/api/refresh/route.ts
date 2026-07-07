import { NextResponse } from "next/server";
import { setMeta } from "@/lib/db";
import { importChannelVideos } from "@/lib/import";
import { TARGET_CHANNEL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/refresh  →  대상(기본) 채널 데이터 최신화 (스케줄러가 1시간마다 호출)
export async function POST() {
  try {
    const result = await importChannelVideos(TARGET_CHANNEL.url);
    if (result.added > 0) setMeta("target_seeded", "1");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "대상 채널 최신화에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
