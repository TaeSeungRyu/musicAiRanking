import { replaceChannelData } from "./db";
import { channelKey, fetchAllChannelVideoIds, fetchYoutubeInfo } from "./youtube";
import { isTargetChannel } from "./config";

const MAX_VIDEOS = 1000; // 안전 상한 (폭주 방지) — 사실상 전체 영상 수집
const CONCURRENCY = 5; // 동시 요청 수 제한 (YouTube 부하 최소화)

export interface ImportResult {
  added: number;
  failed: number;
  total: number;
}

interface CollectedTrack {
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  view_count: number;
  url: string;
  channelId: string | null;
}

/**
 * 채널의 전체 영상을 조회수와 함께 수집한 뒤, 기존 데이터를 통째로 교체 저장합니다.
 * (수집 시 기존 제거 및 재등록 → 삭제된 영상이 남지 않음)
 * source_key 는 실제 channelId 로 저장되어 채널 단위 관리(설정 화면 제거)에 사용됩니다.
 * 대상(기본) 채널이면 is_target=1 로 표시합니다.
 */
export async function importChannelVideos(url: string): Promise<ImportResult> {
  const target = isTargetChannel(url);
  const videoIds = await fetchAllChannelVideoIds(url, MAX_VIDEOS);

  const collected: CollectedTrack[] = [];
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < videoIds.length) {
      const id = videoIds[cursor++];
      try {
        const info = await fetchYoutubeInfo(id);
        collected.push({
          video_id: info.videoId,
          title: info.title,
          channel: info.channel,
          thumbnail: info.thumbnail,
          view_count: info.viewCount,
          url: info.url,
          channelId: info.channelId,
        });
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, worker)
  );

  // 이 채널의 대표 channelId (없으면 URL 기반 키)
  const key = collected.find((c) => c.channelId)?.channelId ?? channelKey(url);
  const name =
    collected.find((c) => c.channel)?.channel ?? channelKey(url) ?? key;

  // 실제 수집분이 있을 때만 교체 (일시 오류로 0개면 기존 데이터 보존)
  if (key && collected.length > 0) {
    replaceChannelData({
      key,
      name,
      url,
      is_target: target,
      tracks: collected.map(({ channelId: _omit, ...t }) => t),
    });
  }

  return { added: collected.length, failed, total: videoIds.length };
}
