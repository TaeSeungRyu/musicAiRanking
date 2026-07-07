import { upsertTrack } from "./db";
import { channelKey, fetchChannelVideoIds, fetchYoutubeInfo } from "./youtube";
import { isTargetChannel } from "./config";

const MAX_VIDEOS = 30; // 채널당 최신 영상 수 제한
const CONCURRENCY = 5; // 동시 요청 수 제한 (YouTube 부하 최소화)

export interface ImportResult {
  added: number;
  failed: number;
  total: number;
}

/**
 * 채널의 최신 영상들을 조회수와 함께 수집해 저장합니다.
 * 대상(기본) 채널이면 is_target=1 로 표시합니다.
 */
export async function importChannelVideos(url: string): Promise<ImportResult> {
  const target = isTargetChannel(url);
  const key = channelKey(url);
  const videoIds = await fetchChannelVideoIds(url, MAX_VIDEOS);

  let added = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < videoIds.length) {
      const id = videoIds[cursor++];
      try {
        const info = await fetchYoutubeInfo(id);
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

  return { added, failed, total: videoIds.length };
}
