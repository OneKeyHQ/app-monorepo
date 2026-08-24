import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IFirmwareSearchDevice = SearchDevice & {
  mode?: string;
  features?: IOneKeyDeviceFeatures;
};

function isMeaningfulIdentifier(value: string | null | undefined) {
  return Boolean(value && !/^0+$/.test(value));
}

function getDeviceIdentifiers(device: SearchDevice) {
  return [
    device.serialNo,
    device.deviceId,
    device.uuid,
    device.connectId,
  ].filter(isMeaningfulIdentifier) as string[];
}

function isBootloaderDevice(device: IFirmwareSearchDevice) {
  return (
    device.mode === 'bootloader' || device.features?.bootloader_mode === true
  );
}

function findUniqueDevice(
  devices: IFirmwareSearchDevice[],
  predicate: (device: IFirmwareSearchDevice) => boolean,
) {
  const matches = devices.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

export function selectFirmwareReconnectDevice({
  previousDevice,
  devices,
}: {
  previousDevice: SearchDevice;
  devices: SearchDevice[];
}) {
  const availableDevices = (devices as IFirmwareSearchDevice[]).filter(
    (device) => Boolean(device.connectId),
  );
  const previousIdentifiers = new Set(getDeviceIdentifiers(previousDevice));
  const hasMatchingIdentifier = (device: SearchDevice) =>
    getDeviceIdentifiers(device).some((identifier) =>
      previousIdentifiers.has(identifier),
    );
  const hasSameTransport = (device: SearchDevice) =>
    device.commType === previousDevice.commType;
  const hasSameDeviceType = (device: SearchDevice) =>
    device.deviceType === previousDevice.deviceType;
  const normalDevices = availableDevices.filter(
    (device) => !isBootloaderDevice(device),
  );

  return (
    findUniqueDevice(
      normalDevices,
      (device) => hasMatchingIdentifier(device) && hasSameTransport(device),
    ) ||
    findUniqueDevice(normalDevices, hasMatchingIdentifier) ||
    findUniqueDevice(
      normalDevices,
      (device) => hasSameDeviceType(device) && hasSameTransport(device),
    ) ||
    findUniqueDevice(normalDevices, hasSameDeviceType) ||
    findUniqueDevice(
      availableDevices,
      (device) => hasMatchingIdentifier(device) && hasSameTransport(device),
    ) ||
    findUniqueDevice(availableDevices, hasMatchingIdentifier) ||
    findUniqueDevice(
      availableDevices,
      (device) => hasSameDeviceType(device) && hasSameTransport(device),
    )
  );
}

export async function resolveFirmwareReconnectDevice({
  previousDevice,
  devices,
  getFeatures,
  onConnectId,
}: {
  previousDevice: SearchDevice;
  devices: SearchDevice[];
  getFeatures: (connectId: string) => Promise<IOneKeyDeviceFeatures>;
  onConnectId?: (connectId: string) => void;
}) {
  const device = selectFirmwareReconnectDevice({ previousDevice, devices });
  if (!device?.connectId) {
    throw new OneKeyLocalError('Firmware device was not uniquely identified');
  }

  onConnectId?.(device.connectId);
  const features = await getFeatures(device.connectId);
  if (features.bootloader_mode) {
    throw new OneKeyLocalError('Firmware device is still in bootloader mode');
  }

  if (
    isMeaningfulIdentifier(previousDevice.deviceId) &&
    isMeaningfulIdentifier(features.device_id) &&
    previousDevice.deviceId !== features.device_id
  ) {
    throw new OneKeyLocalError(
      'Firmware device identity changed after reconnect',
    );
  }

  return { device, features };
}
