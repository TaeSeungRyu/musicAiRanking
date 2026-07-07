import { NextResponse } from "next/server";
import { deleteTrack } from "@/lib/db";

export const runtime = "nodejs";

// DELETE /api/tracks/:id  →  곡 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);
  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
  }
  deleteTrack(numId);
  return NextResponse.json({ ok: true });
}
