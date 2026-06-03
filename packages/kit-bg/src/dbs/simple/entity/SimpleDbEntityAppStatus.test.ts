import { SimpleDbEntityAppStatus } from './SimpleDbEntityAppStatus';

describe('SimpleDbEntityAppStatus wallet low balance analytics status', () => {
  test('gets and sets the last reported timestamp by wallet without clearing existing status', async () => {
    const entity = new SimpleDbEntityAppStatus();
    const setRawData = jest.spyOn(entity, 'setRawData').mockResolvedValue({
      launchTimes: 3,
      walletAllNetworkLowBalanceReportedAtByWalletId: {
        'hd-1': 1_780_000_000_000,
      },
    });

    await entity.setWalletAllNetworkLowBalanceReportedAt({
      walletId: 'hd-1',
      timestamp: 1_780_000_000_000,
    });

    expect(setRawData).toHaveBeenCalledWith(expect.any(Function));

    const updater = setRawData.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');
    expect(
      await (updater as (rawData: unknown) => unknown)({ launchTimes: 3 }),
    ).toEqual({
      launchTimes: 3,
      walletAllNetworkLowBalanceReportedAtByWalletId: {
        'hd-1': 1_780_000_000_000,
      },
    });

    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      launchTimes: 3,
      walletAllNetworkLowBalanceReportedAtByWalletId: {
        'hd-1': 1_780_000_000_000,
        'hw-1': 1_790_000_000_000,
      },
    });

    await expect(
      entity.getWalletAllNetworkLowBalanceReportedAt({ walletId: 'hd-1' }),
    ).resolves.toBe(1_780_000_000_000);
  });
});
