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
    // 실제로 1개 이상 수집된 경우에만 시드 완료로 표시 (일시 오류 시 다음 접속에 재시도)
    if (result.added > 0) {
      setMeta(SEED_FLAG, "1");
    }
    return NextResponse.json({ seeded: result.added > 0, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "대상 채널을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
