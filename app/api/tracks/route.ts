import { NextResponse } from "next/server";
import { getMeta, listTracks, upsertChannel, upsertTrack } from "@/lib/db";
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
      seeded: getMeta("target_seeded") === "1",
    },
  });
}

// POST /api/tracks  →  { url } 로 곡 추가/갱신 (단건)
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
      source_key: info.channelId,
    });
    // 설정 화면 관리용으로 이 영상의 채널도 등록
    if (info.channelId) {
      upsertChannel({
        key: info.channelId,
        name: info.channel,
        url: `https://www.youtube.com/channel/${info.channelId}`,
        is_target: false,
      });
    }
    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "곡을 가져오는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
