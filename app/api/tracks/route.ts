import { NextResponse } from "next/server";
import { hasTargetTracks, listTracks, upsertTrack } from "@/lib/db";
import { fetchYoutubeInfo } from "@/lib/youtube";
import { TARGET_CHANNEL, TARGET_CHANNEL_KEY } from "@/lib/config";

// SQLite/네이티브 모듈 사용 → Node 런타임 강제
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tracks  →  조회수 내림차순 랭킹 목록 + 대상 채널 정보
export async function GET() {
  const tracks = listTracks();
  return NextResponse.json({
    tracks,
    target: {
      name: TARGET_CHANNEL.name,
      key: TARGET_CHANNEL_KEY,
      hasTarget: hasTargetTracks(),
    },
  });
}

// POST /api/tracks  →  { url } 로 곡 추가/갱신
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "URL을 입력해 주세요." }, { status: 400 });
  }

  try {
    const info = await fetchYoutubeInfo(url);
    const track = upsertTrack({
      video_id: info.videoId,
      title: info.title,
      channel: info.channel,
      thumbnail: info.thumbnail,
      view_count: info.viewCount,
      url: info.url,
    });
    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "곡을 가져오는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
