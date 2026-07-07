import { NextResponse } from "next/server";
import { deleteChannelCascade } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/channels/:key  →  채널 + 해당 채널의 모든 영상 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  if (!decoded) {
    return NextResponse.json({ error: "잘못된 채널입니다." }, { status: 400 });
  }
  deleteChannelCascade(decoded);
  return NextResponse.json({ ok: true });
}
