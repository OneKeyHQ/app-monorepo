import { EDeviceType } from '@onekeyfe/hd-shared';

import deviceUtils, { ESupportSettings } from './deviceUtils';

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({
    getDeviceBootloaderVersion: jest.fn(() => []),
    getDeviceFirmwareVersion: jest.fn(() => []),
  })),
}));

describe('deviceUtils', () => {
  it('uses the user label as display name before the BLE connection name', async () => {
    await expect(
      deviceUtils.buildDeviceName({
        device: {
          connectId: 'connect-id',
          uuid: 'uuid',
          deviceId: 'device-id',
          deviceType: EDeviceType.Pro2,
          name: 'Pro2 6136',
        },
        features: {
          label: 'Renamed Pro 2',
          bleName: 'Pro2 6136',
          deviceType: EDeviceType.Pro2,
        } as never,
      }),
    ).resolves.toBe('Renamed Pro 2');
  });

  it.each([
    ESupportSettings.Language,
    ESupportSettings.Brightness,
    ESupportSettings.AutoLock,
    ESupportSettings.AutoShutDown,
    ESupportSettings.HapticFeedback,
  ])('enables the %s setting for Pro 2', (setting) => {
    expect(
      deviceUtils.supportSettings({
        deviceType: EDeviceType.Pro2,
        firmwareVersion: '1.0.0',
        setting,
      }),
    ).toBe(true);
  });

  it('does not read third-party firmware versions from OneKey device helpers', async () => {
    await expect(
      deviceUtils.getDeviceVersion({
        device: undefined,
        features: {
          vendor: 'trezor',
          third_party_firmware_version: '2.8.0',
        } as never,
      }),
    ).resolves.toMatchObject({
      firmwareVersion: '',
    });
  });
});
