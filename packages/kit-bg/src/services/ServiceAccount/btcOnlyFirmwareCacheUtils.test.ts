import { EFirmwareType } from '@onekeyfe/hd-shared';

import { buildBtcOnlyFirmwareCacheKey } from './btcOnlyFirmwareCacheUtils';

describe('buildBtcOnlyFirmwareCacheKey', () => {
  const walletId = 'hw-wallet-1';

  it('invalidates the cache when raw firmware vendor changes', () => {
    const universal = buildBtcOnlyFirmwareCacheKey({
      walletId,
      featuresInfo: {
        vendor: 'onekey.so',
        fw_vendor: 'OneKey',
      },
    });
    const bitcoinOnly = buildBtcOnlyFirmwareCacheKey({
      walletId,
      featuresInfo: {
        vendor: 'onekey.so',
        fw_vendor: 'OneKey Bitcoin-only',
      },
    });

    expect(bitcoinOnly).not.toBe(universal);
  });

  it('invalidates the cache when the App firmware override changes', () => {
    const universal = buildBtcOnlyFirmwareCacheKey({
      walletId,
      featuresInfo: {
        $app_firmware_type: EFirmwareType.Universal,
      },
    });
    const bitcoinOnly = buildBtcOnlyFirmwareCacheKey({
      walletId,
      featuresInfo: {
        $app_firmware_type: EFirmwareType.BitcoinOnly,
      },
    });

    expect(bitcoinOnly).not.toBe(universal);
  });
});
