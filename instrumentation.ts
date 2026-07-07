// Next.js instrumentation: 서버 부팅 시 1회 실행됩니다.
// 대상(기본) 채널을 1시간 단위로 재수집하여 데이터를 최신화합니다. (외부 크론 불필요)
//
// 주의: 이 파일은 edge 런타임으로도 번들될 수 있으므로 네이티브 모듈(better-sqlite3)을
// 끌어오는 lib/db 등을 직접 import 하지 않습니다. 대신 내부 API(/api/refresh)를 fetch 로 호출합니다.

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __targetRefreshTimer?: NodeJS.Timeout };
  // dev 모드 HMR 로 인한 중복 등록 방지
  if (g.__targetRefreshTimer) return;

  const ONE_HOUR = 60 * 60 * 1000;
  const port = process.env.PORT ?? "3000";
  const refreshUrl = `http://127.0.0.1:${port}/api/refresh`;

  const refresh = async () => {
    try {
      const res = await fetch(refreshUrl, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      console.log(
        `[scheduler] 대상 채널 최신화: ${res.status} ${JSON.stringify(data)}`
      );
    } catch (err) {
      console.error("[scheduler] 대상 채널 최신화 호출 실패:", err);
    }
  };

  g.__targetRefreshTimer = setInterval(refresh, ONE_HOUR);
  console.log("[scheduler] 대상 채널 1시간 단위 최신화 스케줄러 등록됨");
}
