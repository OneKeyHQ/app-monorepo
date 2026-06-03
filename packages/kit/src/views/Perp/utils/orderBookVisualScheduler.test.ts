import {
  getPerpsOrderBookVisualSnapshotDelayMs,
  shouldPublishPerpsOrderBookVisualSnapshot,
} from './orderBookVisualScheduler';

describe('orderBookVisualScheduler', () => {
  it('publishes the first visual snapshot immediately', () => {
    expect(
      getPerpsOrderBookVisualSnapshotDelayMs({
        frameMs: 100,
        lastPublishedAt: undefined,
        now: 1000,
      }),
    ).toBe(0);

    expect(
      shouldPublishPerpsOrderBookVisualSnapshot({
        frameMs: 100,
        lastPublishedAt: undefined,
        now: 1000,
      }),
    ).toBe(true);
  });

  it('coalesces updates inside one visual frame', () => {
    expect(
      getPerpsOrderBookVisualSnapshotDelayMs({
        frameMs: 100,
        lastPublishedAt: 1000,
        now: 1030,
      }),
    ).toBe(70);

    expect(
      shouldPublishPerpsOrderBookVisualSnapshot({
        frameMs: 100,
        lastPublishedAt: 1000,
        now: 1030,
      }),
    ).toBe(false);
  });

  it('publishes the latest snapshot once the visual frame expires', () => {
    expect(
      getPerpsOrderBookVisualSnapshotDelayMs({
        frameMs: 100,
        lastPublishedAt: 1000,
        now: 1100,
      }),
    ).toBe(0);

    expect(
      shouldPublishPerpsOrderBookVisualSnapshot({
        frameMs: 100,
        lastPublishedAt: 1000,
        now: 1100,
      }),
    ).toBe(true);
  });
});
