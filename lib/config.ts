import { channelKey } from "./youtube";

/**
 * 기본(대상) 유튜버 채널.
 * 사이트 접속 시 이 채널의 영상 랭킹이 기본으로 표시되며,
 * 다른 채널이 추가되면 이 채널과 비교하여 함께 랭킹됩니다.
 */
export const TARGET_CHANNEL = {
  name: "hyangguni",
  url: "https://www.youtube.com/@hyangguni/videos",
} as const;

/** 정규화 키 (예: "@hyangguni") */
export const TARGET_CHANNEL_KEY = channelKey(TARGET_CHANNEL.url)!;

/** 주어진 채널 URL이 대상 채널인지 여부 */
export function isTargetChannel(url: string): boolean {
  const key = channelKey(url);
  return key !== null && key === TARGET_CHANNEL_KEY;
}
