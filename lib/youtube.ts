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

const VIDEOS_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "ko,en;q=0.9",
} as const;

/**
 * 임의의 JSON 트리에서 영상 videoId 를 순서대로 수집.
 * 구형 videoRenderer/gridVideoRenderer 와 신형 lockupViewModel(contentId) 모두 지원.
 */
function collectVideoIds(node: any, push: (id: unknown) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoIds(item, push);
    return;
  }
  const vr = node.videoRenderer ?? node.gridVideoRenderer;
  if (vr?.videoId) push(vr.videoId);
  // 신형 레이아웃: lockupViewModel 의 contentId 가 videoId
  const lvm = node.lockupViewModel;
  if (lvm?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && lvm?.contentId) {
    push(lvm.contentId);
  }
  for (const key of Object.keys(node)) collectVideoIds(node[key], push);
}

/** 트리에서 다음 페이지 continuation 토큰을 찾음 */
function findContinuationToken(node: any): string | null {
  if (!node || typeof node !== "object") return null;
  const token =
    node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
  if (typeof token === "string") return token;
  if (Array.isArray(node)) {
    for (const item of node) {
      const t = findContinuationToken(item);
      if (t) return t;
    }
    return null;
  }
  for (const key of Object.keys(node)) {
    const t = findContinuationToken(node[key]);
    if (t) return t;
  }
  return null;
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
    headers: VIDEOS_HEADERS,
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
    if (
      typeof id === "string" &&
      /^[a-zA-Z0-9_-]{11}$/.test(id) &&
      !seen.has(id) &&
      ids.length < limit
    ) {
      seen.add(id);
      ids.push(id);
    }
  };

  if (data) collectVideoIds(data, push);

  // 폴백: 구조 파싱 실패 시 HTML 전체에서 정규식으로 videoId 추출
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

/**
 * 채널의 "동영상" 탭 전체 영상 ID를 InnerTube continuation 으로 페이지네이션하여 수집합니다.
 * (첫 30개가 아닌 전체 데이터)
 * @param maxVideos 안전 상한 (폭주 방지)
 */
export async function fetchAllChannelVideoIds(
  channelUrl: string,
  maxVideos = 1000
): Promise<string[]> {
  const videosUrl = toChannelVideosUrl(channelUrl);

  const res = await fetch(videosUrl, { headers: VIDEOS_HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`채널 요청 실패 (HTTP ${res.status})`);
  }
  const html = await res.text();

  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: unknown) => {
    if (
      typeof id === "string" &&
      /^[a-zA-Z0-9_-]{11}$/.test(id) &&
      !seen.has(id) &&
      ids.length < maxVideos
    ) {
      seen.add(id);
      ids.push(id);
    }
  };

  const data = extractJsonAfterMarker(html, "ytInitialData");
  if (data) collectVideoIds(data, push);
  if (ids.length === 0) {
    // 폴백: 첫 페이지만이라도 정규식으로
    const re = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && ids.length < maxVideos) push(m[1]);
    if (ids.length === 0) {
      throw new Error("채널에서 영상을 찾지 못했습니다. URL을 확인해 주세요.");
    }
    return ids; // continuation 파싱 불가 → 첫 페이지 반환
  }

  // InnerTube API 키/클라이언트 버전 추출 (없으면 첫 페이지만 반환)
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientVersion =
    html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] ??
    html.match(/"clientVersion":"([\d.]+)"/)?.[1];

  let token = data ? findContinuationToken(data) : null;
  if (!apiKey || !clientVersion || !token) {
    return ids;
  }

  // 페이지 루프 (안전 상한과 함께)
  for (let page = 0; page < 100 && token && ids.length < maxVideos; page++) {
    let json: any;
    try {
      const r = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`,
        {
          method: "POST",
          headers: {
            ...VIDEOS_HEADERS,
            "Content-Type": "application/json",
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": clientVersion,
            Origin: "https://www.youtube.com",
          },
          body: JSON.stringify({
            context: {
              client: { clientName: "WEB", clientVersion, hl: "ko", gl: "KR" },
            },
            continuation: token,
          }),
          cache: "no-store",
        }
      );
      if (!r.ok) break;
      json = await r.json();
    } catch {
      break;
    }

    const items =
      json?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction
        ?.continuationItems ?? [];
    if (items.length === 0) break;

    const before = ids.length;
    collectVideoIds(items, push);
    token = findContinuationToken(items);

    // 새로 추가된 것이 없고 토큰도 없으면 종료
    if (ids.length === before && !token) break;
  }

  return ids;
}
