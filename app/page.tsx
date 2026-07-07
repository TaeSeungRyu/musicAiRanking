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
    <main className="container">
      <header className="header">
        <h1>🎵 음원 랭킹</h1>
        <p>YouTube URL을 입력하면 조회수 기준으로 랭킹을 만들어 드립니다.</p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? "가져오는 중..." : "추가하기"}
        </button>
      </form>

      {error && <div className="error">⚠️ {error}</div>}

      <div className="list">
        {tracks.length === 0 ? (
          <div className="empty">
            아직 등록된 곡이 없습니다.<br />
            위에 YouTube URL을 입력해 첫 곡을 추가해 보세요!
          </div>
        ) : (
          tracks.map((track, index) => (
            <div className="card" key={track.id}>
              <div className={`rank${index < 3 ? " top" : ""}`}>
                {index + 1}
              </div>
              {track.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={track.thumbnail} alt={track.title} />
              )}
              <div className="info">
                <a href={track.url} target="_blank" rel="noopener noreferrer">
                  {track.title}
                </a>
                {track.channel && (
                  <div className="channel">{track.channel}</div>
                )}
              </div>
              <div className="views">
                <div className="num">{formatViews(track.view_count)}</div>
                <div className="label">조회수</div>
              </div>
              <button
                className="delete-btn"
                onClick={() => handleDelete(track.id)}
                title="삭제"
                aria-label="삭제"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <p className="footer-note">
        조회수는 곡 추가 시점 기준입니다. 같은 URL을 다시 추가하면 최신 조회수로 갱신됩니다.
      </p>
    </main>
  );
}
