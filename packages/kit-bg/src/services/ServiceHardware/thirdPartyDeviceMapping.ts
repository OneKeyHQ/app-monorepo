import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { DeviceInfo } from './adapters/types';
import type { SearchDevice } from '@onekeyfe/hd-core';

export function mapThirdPartyDeviceToSearchDevice({
  device,
  defaultDeviceName,
  canMatchDeviceByConnectId = (connectId) => Boolean(connectId),
}: {
  device: DeviceInfo;
  defaultDeviceName?: string;
  canMatchDeviceByConnectId?: (connectId: string) => boolean;
}): SearchDevice {
  const isUuidLike = (s?: string) =>
    s ? /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s) : false;
  const rawName =
    device.label || (device as DeviceInfo & { name?: string }).name || '';
  const stableConnectId =
    device.connectId && canMatchDeviceByConnectId(device.connectId)
      ? device.connectId
      : null;

  let connectId: string | null;
  switch (device.connectionType) {
    case 'ble':
      if (!stableConnectId) {
        throw new OneKeyLocalError('Third-party BLE connectId is required');
      }
      connectId = stableConnectId;
      break;
    case 'usb':
      connectId = null;
      break;
    default:
      // Transport unknown — fall back to connectId shape heuristic.
      connectId = stableConnectId;
  }

  const displayName =
    rawName && !isUuidLike(rawName)
      ? rawName
      : device.model || defaultDeviceName || '';

  return {
    connectId,
    deviceId: null,
    name: displayName,
    deviceType: 'unknown',
    uuid: '',
    commType: 'bridge',
    // Pass-through: persisted into IDBDeviceSettings.vendorModel/vendorModelName.
    vendorModel: device.model,
    vendorModelName: (device as DeviceInfo & { modelName?: string }).modelName,
  } as SearchDevice;
}
