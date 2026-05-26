import { PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME } from '@onekeyhq/shared/src/consts/primeConsts';

import {
  buildDefaultBotWalletName,
  isDefaultBotWalletName,
  resolveBotWalletSyncItemDataTime,
} from './botWalletCreateUtils';

describe('botWalletCreateUtils', () => {
  it('builds and detects the default bot wallet name for the target index', () => {
    expect(buildDefaultBotWalletName(0)).toBe('Bot #1');
    expect(buildDefaultBotWalletName(4)).toBe('Bot #5');

    expect(isDefaultBotWalletName({ index: 0, name: 'Bot #1' })).toBe(true);
    expect(isDefaultBotWalletName({ index: 0, name: 'Bot #2' })).toBe(false);
    expect(isDefaultBotWalletName({ index: 0, name: 'Trading Bot' })).toBe(
      false,
    );
  });

  it('uses the cloud sync create genesis time for default-name bot wallet creation', async () => {
    const timeNow = jest.fn(async () => 1_800_000_000_000);

    await expect(
      resolveBotWalletSyncItemDataTime({
        shouldUseCreateGenesisTime: true,
        timeNow,
      }),
    ).resolves.toBe(PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME);
    expect(timeNow).not.toHaveBeenCalled();
  });

  it('uses current time for non-default bot wallet changes', async () => {
    const timeNow = jest.fn(async () => 1_800_000_000_000);

    await expect(
      resolveBotWalletSyncItemDataTime({
        shouldUseCreateGenesisTime: false,
        timeNow,
      }),
    ).resolves.toBe(1_800_000_000_000);
    expect(timeNow).toHaveBeenCalledTimes(1);
  });
});
