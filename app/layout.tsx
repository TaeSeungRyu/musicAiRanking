import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🎵 음원 랭킹",
  description: "YouTube URL을 입력해 조회수 기반 음원 랭킹을 만들어 보세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
