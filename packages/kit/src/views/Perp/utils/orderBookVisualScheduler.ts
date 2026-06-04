export const PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS = 1000;

export function getPerpsOrderBookVisualSnapshotDelayMs({
  frameMs,
  lastPublishedAt,
  now,
}: {
  frameMs: number;
  lastPublishedAt?: number;
  now: number;
}) {
  if (lastPublishedAt === undefined) {
    return 0;
  }

  return Math.max(0, frameMs - (now - lastPublishedAt));
}

export function shouldPublishPerpsOrderBookVisualSnapshot({
  frameMs,
  lastPublishedAt,
  now,
}: {
  frameMs: number;
  lastPublishedAt?: number;
  now: number;
}) {
  return (
    getPerpsOrderBookVisualSnapshotDelayMs({
      frameMs,
      lastPublishedAt,
      now,
    }) === 0
  );
}
