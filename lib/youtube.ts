// API 키 없이 YouTube 워치 페이지를 직접 파싱해 제목/조회수/채널을 가져옵니다.

export interface YoutubeInfo {
  videoId: string;
  title: string;
  channel: string | null;
  thumbnail: string;
  viewCount: number;
  url: string;
}

/**
 * 다양한 형태의 YouTube URL에서 videoId(11자)를 추출합니다.
 * 지원: youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/
 */
export function extractVideoId(input: string): string | null {
  const raw = input.trim();

  // 이미 11자리 순수 ID를 붙여넣은 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
    return raw;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    const match = url.pathname.match(/\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

/** ytInitialPlayerResponse JSON을 HTML에서 안전하게 추출 */
function extractPlayerResponse(html: string): any | null {
  const marker = "ytInitialPlayerResponse";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const braceStart = html.indexOf("{", start);
  if (braceStart === -1) return null;

  // 중괄호 균형을 맞춰 JSON 객체 끝을 찾음 (문자열 내부 이스케이프 고려)
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = html.slice(braceStart, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * videoId로 영상 메타데이터를 조회합니다.
 * @throws 영상을 찾을 수 없거나 파싱 실패 시 에러
 */
export async function fetchYoutubeInfo(rawUrl: string): Promise<YoutubeInfo> {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    throw new Error("유효한 YouTube URL이 아닙니다.");
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const res = await fetch(watchUrl, {
    headers: {
      // 데스크톱 브라우저처럼 보여야 ytInitialPlayerResponse가 포함됩니다.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ko,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`YouTube 요청 실패 (HTTP ${res.status})`);
  }

  const html = await res.text();
  const player = extractPlayerResponse(html);

  if (!player) {
    throw new Error("영상 정보를 파싱하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const status = player?.playabilityStatus?.status;
  if (status && status !== "OK") {
    const reason =
      player?.playabilityStatus?.reason ?? "재생할 수 없는 영상입니다.";
    throw new Error(`영상을 가져올 수 없습니다: ${reason}`);
  }

  const details = player?.videoDetails;
  if (!details || !details.title) {
    throw new Error("영상 제목을 찾을 수 없습니다.");
  }

  const viewCount = Number.parseInt(details.viewCount ?? "0", 10) || 0;
  const thumbs = details?.thumbnail?.thumbnails ?? [];
  const thumbnail =
    thumbs.length > 0
      ? thumbs[thumbs.length - 1].url
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    videoId,
    title: details.title,
    channel: details.author ?? null,
    thumbnail,
    viewCount,
    url: watchUrl,
  };
}
