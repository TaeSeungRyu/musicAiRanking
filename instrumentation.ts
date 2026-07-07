// Next.js instrumentation: 서버 부팅 시 1회 실행됩니다.
// 대상(기본) 채널을 1시간 단위로 재수집하여 데이터를 최신화합니다. (외부 크론 불필요)

export async function register() {
  // Node 런타임에서만 스케줄러 등록 (edge 런타임 제외)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __targetRefreshTimer?: NodeJS.Timeout };
  // dev 모드 HMR 로 인한 중복 등록 방지
  if (g.__targetRefreshTimer) return;

  const { importChannelVideos } = await import("./lib/import");
  const { TARGET_CHANNEL } = await import("./lib/config");
  const { setMeta } = await import("./lib/db");

  const ONE_HOUR = 60 * 60 * 1000;

  const refresh = async () => {
    try {
      const result = await importChannelVideos(TARGET_CHANNEL.url);
      if (result.added > 0) setMeta("target_seeded", "1");
      console.log(
        `[scheduler] 대상 채널 최신화 완료: ${result.added}개 (실패 ${result.failed})`
      );
    } catch (err) {
      console.error("[scheduler] 대상 채널 최신화 실패:", err);
    }
  };

  g.__targetRefreshTimer = setInterval(refresh, ONE_HOUR);
  console.log("[scheduler] 대상 채널 1시간 단위 최신화 스케줄러 등록됨");
}
