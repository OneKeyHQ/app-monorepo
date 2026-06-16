import { SimpleDbEntityAppStatus } from './SimpleDbEntityAppStatus';

describe('SimpleDbEntityAppStatus wallet asset status analytics', () => {
  test('gets and sets instance asset status without clearing existing status', async () => {
    const entity = new SimpleDbEntityAppStatus();
    const setRawData = jest.spyOn(entity, 'setRawData').mockResolvedValue({
      launchTimes: 3,
      walletAssetStatusAnalytics: {
        assetStatus: 'low',
        lastSnapshotReportedAt: 1_780_000_000_000,
        lastStatusChangedAt: 1_780_000_000_000,
      },
    });

    await entity.setWalletAssetStatusAnalytics({
      assetStatus: 'low',
      lastSnapshotReportedAt: 1_780_000_000_000,
      lastStatusChangedAt: 1_780_000_000_000,
    });

    expect(setRawData).toHaveBeenCalledWith(expect.any(Function));

    const updater = setRawData.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');
    expect(
      await (updater as (rawData: unknown) => unknown)({ launchTimes: 3 }),
    ).toEqual({
      launchTimes: 3,
      walletAssetStatusAnalytics: {
        assetStatus: 'low',
        lastSnapshotReportedAt: 1_780_000_000_000,
        lastStatusChangedAt: 1_780_000_000_000,
      },
    });

    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      launchTimes: 3,
      walletAssetStatusAnalytics: {
        assetStatus: 'funded',
        lastSnapshotReportedAt: 1_790_000_000_000,
        lastStatusChangedAt: 1_790_000_000_000,
      },
    });

    await expect(entity.getWalletAssetStatusAnalytics()).resolves.toEqual({
      assetStatus: 'funded',
      lastSnapshotReportedAt: 1_790_000_000_000,
      lastStatusChangedAt: 1_790_000_000_000,
    });
  });
});
