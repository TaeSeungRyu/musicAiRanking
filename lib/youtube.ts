// API 키 없이 YouTube 워치 페이지를 직접 파싱해 제목/조회수/채널을 가져옵니다.

export interface YoutubeInfo {
  videoId: string;
  title: string;
  channel: string | null;
  channelId: string | null;
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

/** 지정한 마커(변수명) 뒤의 JSON 객체를 HTML에서 안전하게 추출 */
function extractJsonAfterMarker(html: string, marker: string): any | null {
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
  const player = extractJsonAfterMarker(html, "ytInitialPlayerResponse");

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
    channelId: details.channelId ?? null,
    thumbnail,
    viewCount,
    url: watchUrl,
  };
}

const CHANNEL_PATH_RE = /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/;

/** 입력이 (영상이 아닌) YouTube 채널 URL인지 판별 */
export function isChannelUrl(input: string): boolean {
  const raw = input.trim();
  // 영상 ID/URL이면 채널이 아님
  if (extractVideoId(raw)) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "m.youtube.com") return false;
  return CHANNEL_PATH_RE.test(url.pathname);
}

/**
 * 채널 URL을 비교용 정규화 키로 변환합니다 (탭/쿼리/대소문자 무시).
 * 예) https://www.youtube.com/@Hyangguni/videos → "@hyangguni"
 */
export function channelKey(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const match = url.pathname.match(CHANNEL_PATH_RE);
  if (!match) return null;
  return match[0].replace(/^\//, "").toLowerCase();
}

/** 채널 URL을 해당 채널의 "동영상" 탭 URL로 정규화 */
function toChannelVideosUrl(input: string): string {
  const url = new URL(input.trim());
  const match = url.pathname.match(CHANNEL_PATH_RE);
  const base = match ? match[0] : url.pathname;
  return `https://www.youtube.com${base.replace(/\/$/, "")}/videos`;
}

/**
 * 채널의 "동영상" 탭에서 영상 ID 목록을 추출합니다 (최신순, 초기 로드분).
 * @throws 채널을 찾을 수 없거나 영상이 없을 때
 */
export async function fetchChannelVideoIds(
  channelUrl: string,
  limit = 30
): Promise<string[]> {
  const videosUrl = toChannelVideosUrl(channelUrl);

  const res = await fetch(videosUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ko,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`채널 요청 실패 (HTTP ${res.status})`);
  }

  const html = await res.text();
  const data = extractJsonAfterMarker(html, "ytInitialData");

  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: unknown) => {
    if (typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };

  // 1차: ytInitialData의 richGrid 구조에서 videoId 수집 (순서 보존)
  if (data) {
    const collect = (node: any) => {
      if (!node || typeof node !== "object" || ids.length >= limit) return;
      if (Array.isArray(node)) {
        for (const item of node) collect(item);
        return;
      }
      const vr = node.videoRenderer ?? node.gridVideoRenderer;
      if (vr?.videoId) push(vr.videoId);
      for (const key of Object.keys(node)) collect(node[key]);
    };
    collect(data);
  }

  // 2차(폴백): 구조 파싱 실패 시 HTML 전체에서 정규식으로 videoId 추출
  if (ids.length === 0) {
    const re = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && ids.length < limit) push(m[1]);
  }

  if (ids.length === 0) {
    throw new Error("채널에서 영상을 찾지 못했습니다. URL을 확인해 주세요.");
  }

  return ids.slice(0, limit);
}
