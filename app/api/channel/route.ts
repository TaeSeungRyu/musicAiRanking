import { NextResponse } from "next/server";
import { importChannelVideos } from "@/lib/import";
import { isChannelUrl } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const result = await importChannelVideos(url);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "채널 정보를 가져오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
