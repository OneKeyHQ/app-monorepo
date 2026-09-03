import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import {
  resolveFirmwareReconnectDevice,
  selectFirmwareReconnectDevice,
} from './firmwareReconnectUtils';

import type { SearchDevice } from '@onekeyfe/hd-core';

const createDevice = (
  overrides: Partial<SearchDevice> & {
    mode?: string;
    features?: IOneKeyDeviceFeatures;
  } = {},
) =>
  ({
    connectId: 'CLA45F0023',
    serialNo: 'CLA45F0023',
    uuid: 'CLA45F0023',
    deviceId: 'device-id',
    deviceType: 'classic1s',
    name: 'OneKey Classic 1S',
    commType: 'webusb',
    mode: 'normal',
    ...overrides,
  }) as SearchDevice;

describe('firmwareReconnectUtils', () => {
  const bootloaderDevice = createDevice({
    connectId: '000000000000000000000000',
    serialNo: '',
    uuid: '',
    deviceId: null,
    mode: 'bootloader',
    features: { bootloader_mode: true } as IOneKeyDeviceFeatures,
  });
  const normalDevice = createDevice();

  it('selects the unique normal device after a bootloader identity change', () => {
    expect(
      selectFirmwareReconnectDevice({
        previousDevice: bootloaderDevice,
        devices: [bootloaderDevice, normalDevice],
      }),
    ).toBe(normalDevice);
  });

  it('reads fresh features with the newly enumerated connectId', async () => {
    const features = {
      bootloader_mode: null,
      device_id: 'device-id',
    } as IOneKeyDeviceFeatures;
    const getFeatures = jest.fn().mockResolvedValue(features);
    const onConnectId = jest.fn();

    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: bootloaderDevice,
        devices: [normalDevice],
        getFeatures,
        onConnectId,
      }),
    ).resolves.toEqual({ device: normalDevice, features });
    expect(onConnectId).toHaveBeenCalledWith('CLA45F0023');
    expect(getFeatures).toHaveBeenCalledWith('CLA45F0023');
    expect(getFeatures).not.toHaveBeenCalledWith('000000000000000000000000');
  });

  it('uses stable identity when more than one same-model device is present', () => {
    const previousNormalDevice = createDevice();
    const otherNormalDevice = createDevice({
      connectId: 'CLA45F0099',
      serialNo: 'CLA45F0099',
      uuid: 'CLA45F0099',
      deviceId: 'other-device-id',
    });

    expect(
      selectFirmwareReconnectDevice({
        previousDevice: previousNormalDevice,
        devices: [otherNormalDevice, normalDevice],
      }),
    ).toBe(normalDevice);
  });

  it('keeps retrying while the only device is still in bootloader mode', async () => {
    const getFeatures = jest.fn().mockResolvedValue({
      bootloader_mode: true,
    } as IOneKeyDeviceFeatures);

    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: bootloaderDevice,
        devices: [bootloaderDevice],
        getFeatures,
      }),
    ).rejects.toThrow('Firmware device is still in bootloader mode');
  });

  it('fails closed when multiple same-model devices cannot be distinguished', () => {
    const secondNormalDevice = createDevice({
      connectId: 'CLA45F0099',
      serialNo: 'CLA45F0099',
      uuid: 'CLA45F0099',
      deviceId: 'other-device-id',
    });

    expect(
      selectFirmwareReconnectDevice({
        previousDevice: bootloaderDevice,
        devices: [normalDevice, secondNormalDevice],
      }),
    ).toBeUndefined();
  });
});
