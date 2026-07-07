import { upsertChannel, upsertTrack } from "./db";
import { channelKey, fetchAllChannelVideoIds, fetchYoutubeInfo } from "./youtube";
import { isTargetChannel } from "./config";

const MAX_VIDEOS = 1000; // 안전 상한 (폭주 방지) — 사실상 전체 영상 수집
const CONCURRENCY = 5; // 동시 요청 수 제한 (YouTube 부하 최소화)

export interface ImportResult {
  added: number;
  failed: number;
  total: number;
}

/**
 * 채널의 전체 영상을 조회수와 함께 수집해 저장합니다 (continuation 페이지네이션).
 * source_key 는 실제 channelId 로 저장되어 채널 단위 관리(설정 화면 제거)에 사용됩니다.
 * 대상(기본) 채널이면 is_target=1 로 표시합니다.
 */
export async function importChannelVideos(url: string): Promise<ImportResult> {
  const target = isTargetChannel(url);
  const videoIds = await fetchAllChannelVideoIds(url, MAX_VIDEOS);

  let added = 0;
  let failed = 0;
  let cursor = 0;
  // 채널 메타(첫 성공 영상에서 확보)
  let channelId: string | null = null;
  let channelName: string | null = null;

  async function worker() {
    while (cursor < videoIds.length) {
      const id = videoIds[cursor++];
      try {
        const info = await fetchYoutubeInfo(id);
        const key = info.channelId ?? channelKey(url);
        if (!channelId && info.channelId) {
          channelId = info.channelId;
          channelName = info.channel;
        }
        upsertTrack({
          video_id: info.videoId,
          title: info.title,
          channel: info.channel,
          thumbnail: info.thumbnail,
          view_count: info.viewCount,
          url: info.url,
          is_target: target,
          source_key: key,
        });
        added++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, worker)
  );

  // 설정 화면용 채널 레코드 등록
  const key = channelId ?? channelKey(url);
  if (key) {
    upsertChannel({
      key,
      name: channelName ?? channelKey(url) ?? key,
      url,
      is_target: target,
    });
  }

  return { added, failed, total: videoIds.length };
}
