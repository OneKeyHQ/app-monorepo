import { EDeviceType } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import { resolveHardwarePassphraseEnabled } from './passphraseStateUtils';

import type { SearchDevice } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      getDeviceState: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceTypeFromFeatures: jest.fn(async () => EDeviceType.Pro2),
  },
}));

const device = {
  connectId: 'PRO2_CONNECT_ID',
  deviceType: EDeviceType.Pro2,
} as SearchDevice;

const serviceHardwareMock = jest.mocked(backgroundApiProxy.serviceHardware);

describe('resolveHardwarePassphraseEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('使用刷新后的 Pro2 settings 状态判断 Passphrase 已开启', async () => {
    serviceHardwareMock.getDeviceState.mockResolvedValue({
      status: { passphraseProtection: true },
    } as never);

    await expect(
      resolveHardwarePassphraseEnabled({
        device,
        features: {
          passphraseProtection: null,
          unlocked: true,
        } as IOneKeyDeviceFeatures,
      }),
    ).resolves.toBe(true);

    expect(serviceHardwareMock.getDeviceState.mock.calls).toEqual([
      [
        {
          connectId: 'PRO2_CONNECT_ID',
          params: { scope: 'settings' },
        },
      ],
    ]);
  });

  it('刷新后仍无法确认 Pro2 Passphrase 状态时抛错', async () => {
    serviceHardwareMock.getDeviceState.mockResolvedValue({
      status: { passphraseProtection: null },
    } as never);

    await expect(
      resolveHardwarePassphraseEnabled({
        device,
        features: {
          passphraseProtection: null,
          unlocked: true,
        } as IOneKeyDeviceFeatures,
      }),
    ).rejects.toThrow('Unable to determine Pro2 passphrase state');
  });
});
