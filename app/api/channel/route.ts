import { NextResponse } from "next/server";
import { upsertTrack } from "@/lib/db";
import { fetchChannelVideoIds, fetchYoutubeInfo, isChannelUrl } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEOS = 30; // 초기 로드분 최신 영상 수 제한
const CONCURRENCY = 5; // 동시 요청 수 제한 (YouTube 부하 최소화)

// POST /api/channel  →  { url } 채널의 최신 영상들을 일괄 추가
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "채널 URL을 입력해 주세요." }, { status: 400 });
  }
  if (!isChannelUrl(url)) {
    return NextResponse.json(
      { error: "유효한 YouTube 채널 URL이 아닙니다." },
      { status: 400 }
    );
  }

  let videoIds: string[];
  try {
    videoIds = await fetchChannelVideoIds(url, MAX_VIDEOS);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "채널 정보를 가져오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 동시성 제한 워커 풀로 각 영상의 정확한 조회수를 조회 후 저장
  let added = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < videoIds.length) {
      const id = videoIds[cursor++];
      try {
        const info = await fetchYoutubeInfo(id);
        upsertTrack({
          video_id: info.videoId,
          title: info.title,
          channel: info.channel,
          thumbnail: info.thumbnail,
          view_count: info.viewCount,
          url: info.url,
        });
        added++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, worker)
  );

  return NextResponse.json({
    added,
    failed,
    total: videoIds.length,
  });
}
