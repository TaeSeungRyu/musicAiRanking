"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Channel {
  key: string;
  name: string | null;
  url: string | null;
  is_target: number;
  track_count: number;
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

export default function Settings() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function loadChannels() {
    const res = await fetch("/api/channels");
    const data = await res.json();
    setChannels(data.channels ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    loadChannels();
  }, []);

  async function handleRemove(ch: Channel) {
    const label = ch.name ?? ch.key;
    if (
      !confirm(
        `'${label}' 채널을 제거하면 이 채널의 영상 ${ch.track_count}개가 사이트에서 모두 내려갑니다. 계속할까요?`
      )
    ) {
      return;
    }
    setRemoving(ch.key);
    try {
      await fetch(`/api/channels/${encodeURIComponent(ch.key)}`, {
        method: "DELETE",
      });
      await loadChannels();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <main className="min-h-dvh bg-surface">
      {/* Top App Bar */}
      <header className="bg-primary text-on-primary elevation-2">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:py-5">
          <Link
            href="/"
            aria-label="랭킹으로 돌아가기"
            className="state-layer flex h-10 w-10 items-center justify-center rounded-full"
          >
            <Icon name="arrow_back" className="text-2xl" />
          </Link>
          <div>
            <h1 className="text-xl font-medium sm:text-2xl">설정 · 채널 관리</h1>
            <p className="text-xs text-on-primary/80 sm:text-sm">
              채널을 제거하면 해당 영상이 랭킹에서 모두 내려갑니다.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {!loaded ? (
          <div className="flex justify-center py-16 text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-3xl" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-m3-lg border border-dashed border-outline-variant px-6 py-16 text-center text-on-surface-variant">
            <Icon name="tv_off" className="text-5xl opacity-60" />
            <p className="text-sm">
              등록된 채널이 없습니다.
              <br />
              랭킹 화면에서 채널 URL을 추가해 보세요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {channels.map((ch) => (
              <li
                key={ch.key}
                className={`flex items-center gap-3 rounded-m3-lg p-4 elevation-1 sm:gap-4 ${
                  ch.is_target
                    ? "bg-primary-container/50 ring-1 ring-primary/30"
                    : "bg-surface-container-high"
                }`}
              >
                <Icon
                  name={ch.is_target ? "star" : "subscriptions"}
                  className={`text-2xl ${
                    ch.is_target ? "text-primary" : "text-on-surface-variant"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-on-surface">
                      {ch.name ?? ch.key}
                    </span>
                    {ch.is_target === 1 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-on-primary sm:text-xs">
                        대상
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-on-surface-variant sm:text-sm">
                    영상 {ch.track_count}개
                    {ch.url && (
                      <>
                        {" · "}
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline"
                        >
                          채널 열기
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(ch)}
                  disabled={removing === ch.key}
                  className="state-layer flex h-10 items-center gap-1.5 rounded-m3-xl border border-outline px-4 text-sm font-medium text-error transition-colors hover:bg-error-container disabled:opacity-50"
                >
                  {removing === ch.key ? (
                    <Icon name="progress_activity" className="animate-spin text-lg" />
                  ) : (
                    <Icon name="delete" className="text-lg" />
                  )}
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
