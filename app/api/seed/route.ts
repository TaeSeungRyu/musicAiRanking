import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db";
import { importChannelVideos } from "@/lib/import";
import { TARGET_CHANNEL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEED_FLAG = "target_seeded";

// POST /api/seed  →  대상(기본) 채널을 최초 1회만 자동 수집
// (사용자가 설정 화면에서 대상 채널을 제거한 뒤에는 재시드하지 않음)
export async function POST() {
  if (getMeta(SEED_FLAG) === "1") {
    return NextResponse.json({ seeded: false, reason: "already-seeded" });
  }

  try {
    const result = await importChannelVideos(TARGET_CHANNEL.url);
    setMeta(SEED_FLAG, "1");
    return NextResponse.json({ seeded: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "대상 채널을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
