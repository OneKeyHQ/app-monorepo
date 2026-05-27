import { getPerpsL2BookSnapshotCacheKeys, swrKeys } from './swrCacheUtils';

describe('perps L2 book SWR cache keys', () => {
  it('uses only the default key when no tick option is requested', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
      }),
    ]);
  });

  it('does not fall back option-specific snapshots to the default key', () => {
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
    ]);
  });
});
