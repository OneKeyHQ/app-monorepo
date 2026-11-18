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

  it('returns a confirmed bootloader only when recovery is explicitly allowed', async () => {
    const features = {
      bootloader_mode: true,
      device_id: normalDevice.deviceId,
    } as IOneKeyDeviceFeatures;
    const getFeatures = jest.fn().mockResolvedValue(features);
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [normalDevice],
        getFeatures,
      }),
    ).rejects.toThrow('still in bootloader');
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [normalDevice],
        getFeatures,
        allowBootloaderRecovery: true,
      }),
    ).resolves.toEqual({ device: normalDevice, features });
  });

  it.each([true, false])(
    'rejects a fresh identity mismatch in bootloader=%s',
    async (bootloaderMode) => {
      await expect(
        resolveFirmwareReconnectDevice({
          previousDevice: normalDevice,
          devices: [normalDevice],
          getFeatures: jest.fn().mockResolvedValue({
            bootloader_mode: bootloaderMode,
            device_id: 'other-device-id',
          }),
          allowBootloaderRecovery: true,
        }),
      ).rejects.toThrow('identity changed');
    },
  );

  it('accepts stable search identity when bootloader omits device_id', async () => {
    const device = createDevice({ deviceId: null, mode: 'bootloader' });
    const features = { bootloader_mode: true } as IOneKeyDeviceFeatures;
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [device],
        getFeatures: jest.fn().mockResolvedValue(features),
        allowBootloaderRecovery: true,
      }),
    ).resolves.toEqual({ device, features });
  });

  it('supports a unique bootloader with only zero-filled identity placeholders', async () => {
    const features = { bootloader_mode: true } as IOneKeyDeviceFeatures;
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [bootloaderDevice],
        getFeatures: jest.fn().mockResolvedValue(features),
        allowBootloaderRecovery: true,
      }),
    ).resolves.toEqual({ device: bootloaderDevice, features });
  });

  it('rejects a bootloader with conflicting search identity when device_id is unavailable', async () => {
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [
          createDevice({
            mode: 'bootloader',
            deviceId: null,
            connectId: 'other-connect-id',
            serialNo: 'other-serial',
            uuid: 'other-uuid',
          }),
        ],
        getFeatures: jest.fn().mockResolvedValue({ bootloader_mode: true }),
        allowBootloaderRecovery: true,
      }),
    ).rejects.toThrow('bootloader identity was not confirmed');
  });

  it('fails closed for ambiguous bootloaders even when recovery is allowed', async () => {
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [bootloaderDevice, { ...bootloaderDevice, connectId: '0000' }],
        getFeatures: jest.fn(),
        allowBootloaderRecovery: true,
      }),
    ).rejects.toThrow('not uniquely identified');
  });

  it('prefers the identified bootloader over another same-model application device for recovery', async () => {
    const device = createDevice({ mode: 'bootloader' });
    const otherDevice = createDevice({
      deviceId: 'other-device-id',
      serialNo: 'other-serial',
      uuid: 'other-uuid',
      connectId: 'other-connect-id',
    });
    const features = {
      bootloader_mode: true,
      device_id: normalDevice.deviceId,
    } as IOneKeyDeviceFeatures;
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [otherDevice, device],
        getFeatures: jest.fn().mockResolvedValue(features),
        allowBootloaderRecovery: true,
      }),
    ).resolves.toEqual({ device, features });
  });

  it('propagates a failed connection instead of returning a recovery device', async () => {
    await expect(
      resolveFirmwareReconnectDevice({
        previousDevice: normalDevice,
        devices: [normalDevice],
        getFeatures: jest.fn().mockRejectedValue(new Error('Disconnected')),
        allowBootloaderRecovery: true,
      }),
    ).rejects.toThrow('Disconnected');
  });
});
