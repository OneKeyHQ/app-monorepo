import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import { resolveHardwarePassphraseEnabled } from './passphraseStateUtils';

describe('resolveHardwarePassphraseEnabled', () => {
  it('兼容老设备的 passphrase_protection 字段', () => {
    expect(
      resolveHardwarePassphraseEnabled({
        features: {
          passphrase_protection: true,
          unlocked: true,
        } as IOneKeyDeviceFeatures,
      }),
    ).toBe(true);
  });

  it('旧字段缺失时兼容 DeviceState 投影的 passphraseProtection 字段', () => {
    expect(
      resolveHardwarePassphraseEnabled({
        features: {
          passphraseProtection: true,
          unlocked: true,
        } as IOneKeyDeviceFeatures,
      }),
    ).toBe(true);
  });

  it('设备状态关闭 Passphrase 时使用标准钱包', () => {
    expect(
      resolveHardwarePassphraseEnabled({
        features: {
          passphrase_protection: false,
          passphraseProtection: false,
          unlocked: true,
        } as IOneKeyDeviceFeatures,
      }),
    ).toBe(false);
  });
});
