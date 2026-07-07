"use client";

import { useEffect, useState } from "react";

interface Track {
  id: number;
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  view_count: number;
  url: string;
}

function formatViews(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

/** Material Symbols 아이콘 */
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`material-symbols-rounded leading-none select-none ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

const RANK_STYLES = [
  "bg-primary text-on-primary", // 1위
  "bg-secondary-container text-on-secondary-container", // 2위
  "bg-primary-container text-on-primary-container", // 3위
];

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTracks() {
    const res = await fetch("/api/tracks");
    const data = await res.json();
    setTracks(data.tracks ?? []);
  }

  useEffect(() => {
    loadTracks();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "곡을 추가하지 못했습니다.");
      } else {
        setUrl("");
        await loadTracks();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/tracks/${id}`, { method: "DELETE" });
    await loadTracks();
  }

  return (
    <main className="min-h-dvh bg-surface">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary elevation-2">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:py-5">
          <Icon name="music_note" className="text-3xl" />
          <div>
            <h1 className="text-xl font-medium sm:text-2xl">음원 랭킹</h1>
            <p className="text-xs text-on-primary/80 sm:text-sm">
              YouTube URL로 만드는 조회수 랭킹
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {/* 입력 카드 (Material outlined text field + filled button) */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-m3-lg bg-surface-container p-4 elevation-1 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-2 rounded-m3 border border-outline-variant bg-surface px-4 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <Icon
              name="link"
              className="text-xl text-on-surface-variant"
            />
            <input
              type="text"
              inputMode="url"
              placeholder="YouTube URL 붙여넣기"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="state-layer flex h-12 items-center justify-center gap-2 rounded-m3-xl bg-primary px-6 font-medium text-on-primary transition-shadow elevation-1 hover:elevation-2 disabled:opacity-50 disabled:elevation-0"
          >
            {loading ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-xl" />
                가져오는 중
              </>
            ) : (
              <>
                <Icon name="add" className="text-xl" />
                추가하기
              </>
            )}
          </button>
        </form>

        {/* 에러 (Material error container) */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-m3 bg-error-container px-4 py-3 text-sm text-on-error-container">
            <Icon name="error" className="text-xl" />
            <span>{error}</span>
          </div>
        )}

        {/* 랭킹 리스트 */}
        <section className="mt-6">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-m3-lg border border-dashed border-outline-variant px-6 py-16 text-center text-on-surface-variant">
              <Icon name="queue_music" className="text-5xl opacity-60" />
              <p className="text-sm">
                아직 등록된 곡이 없습니다.
                <br />
                위에 YouTube URL을 입력해 첫 곡을 추가해 보세요!
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {tracks.map((track, index) => (
                <li
                  key={track.id}
                  className="state-layer flex items-center gap-3 rounded-m3-lg bg-surface-container-high p-3 elevation-1 transition-shadow hover:elevation-2 sm:gap-4 sm:p-4"
                >
                  {/* 랭크 배지 */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold sm:h-12 sm:w-12 sm:text-lg ${
                      RANK_STYLES[index] ??
                      "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* 썸네일 */}
                  {track.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="hidden h-14 w-24 shrink-0 rounded-m3-sm object-cover xs:block sm:h-16 sm:w-28"
                    />
                  )}

                  {/* 정보 */}
                  <div className="min-w-0 flex-1">
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 font-medium text-on-surface hover:text-primary sm:truncate"
                    >
                      {track.title}
                    </a>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-on-surface-variant sm:text-sm">
                      {track.channel && (
                        <span className="truncate">{track.channel}</span>
                      )}
                      <span className="flex shrink-0 items-center gap-1">
                        <Icon name="visibility" className="text-sm" />
                        {formatViews(track.view_count)}
                      </span>
                    </div>
                  </div>

                  {/* 액션: 열기 / 삭제 */}
                  <div className="flex shrink-0 items-center">
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="YouTube에서 열기"
                      aria-label="YouTube에서 열기"
                      className="state-layer flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-primary"
                    >
                      <Icon name="open_in_new" className="text-xl" />
                    </a>
                    <button
                      onClick={() => handleDelete(track.id)}
                      title="삭제"
                      aria-label="삭제"
                      className="state-layer flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-error"
                    >
                      <Icon name="delete" className="text-xl" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-on-surface-variant">
          조회수는 곡 추가 시점 기준입니다. 같은 URL을 다시 추가하면 최신
          조회수로 갱신됩니다.
        </p>
      </div>
    </main>
  );
}
