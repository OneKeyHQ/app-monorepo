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
  allowBootloaderRecovery = false,
}: {
  previousDevice: SearchDevice;
  devices: SearchDevice[];
  allowBootloaderRecovery?: boolean;
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
  const preferredDevices = availableDevices.filter(
    (device) => allowBootloaderRecovery || !isBootloaderDevice(device),
  );

  return (
    findUniqueDevice(
      preferredDevices,
      (device) => hasMatchingIdentifier(device) && hasSameTransport(device),
    ) ||
    findUniqueDevice(preferredDevices, hasMatchingIdentifier) ||
    findUniqueDevice(
      preferredDevices,
      (device) => hasSameDeviceType(device) && hasSameTransport(device),
    ) ||
    findUniqueDevice(preferredDevices, hasSameDeviceType) ||
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
  allowBootloaderRecovery = false,
}: {
  previousDevice: SearchDevice;
  devices: SearchDevice[];
  getFeatures: (connectId: string) => Promise<IOneKeyDeviceFeatures>;
  onConnectId?: (connectId: string) => void;
  allowBootloaderRecovery?: boolean;
}) {
  const device = selectFirmwareReconnectDevice({
    previousDevice,
    devices,
    allowBootloaderRecovery,
  });
  if (!device?.connectId) {
    throw new OneKeyLocalError('Firmware device was not uniquely identified');
  }

  onConnectId?.(device.connectId);
  const features = await getFeatures(device.connectId);
  if (
    isMeaningfulIdentifier(previousDevice.deviceId) &&
    isMeaningfulIdentifier(features.device_id) &&
    previousDevice.deviceId !== features.device_id
  ) {
    throw new OneKeyLocalError(
      'Firmware device identity changed after reconnect',
    );
  }

  if (features.bootloader_mode) {
    if (!allowBootloaderRecovery) {
      throw new OneKeyLocalError('Firmware device is still in bootloader mode');
    }
    // Bootloaders may expose only zero-filled placeholders. Keep the unique
    // model/transport fallback for those, but reject conflicting real identities.
    const previousIdentifiers = new Set(getDeviceIdentifiers(previousDevice));
    const deviceIdentifiers = getDeviceIdentifiers(device);
    const matchesSearchIdentity = deviceIdentifiers.some((identifier) =>
      previousIdentifiers.has(identifier),
    );
    const matchesFeatureIdentity =
      isMeaningfulIdentifier(previousDevice.deviceId) &&
      previousDevice.deviceId === features.device_id;
    if (
      previousIdentifiers.size &&
      deviceIdentifiers.length &&
      !matchesSearchIdentity &&
      !matchesFeatureIdentity
    ) {
      throw new OneKeyLocalError(
        'Firmware bootloader identity was not confirmed',
      );
    }
  }

  return { device, features };
}
