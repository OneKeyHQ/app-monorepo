import { getPerpsL2BookSnapshotCacheKeys, swrKeys } from './swrCacheUtils';

describe('perps L2 book SWR cache keys', () => {
  it('uses a stable key for cached order book tick options', () => {
    expect(swrKeys.perpsOrderBookTickOptions()).toBe('perpsOrderBookTicks:v1');
  });

  it('uses the default and latest keys when no tick option is requested', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });

  it('falls back option-specific snapshots only to the coin latest key', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });
});
