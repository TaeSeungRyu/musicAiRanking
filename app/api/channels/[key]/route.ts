import { NextResponse } from "next/server";
import { deleteChannelCascade, isChannelTarget } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/channels/:key  →  채널 + 해당 채널의 모든 영상 삭제
// 단, 기본 대상 채널은 제거할 수 없습니다.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  if (!decoded) {
    return NextResponse.json({ error: "잘못된 채널입니다." }, { status: 400 });
  }
  if (isChannelTarget(decoded)) {
    return NextResponse.json(
      { error: "기본 대상 채널은 제거할 수 없습니다." },
      { status: 403 }
    );
  }
  deleteChannelCascade(decoded);
  return NextResponse.json({ ok: true });
}
