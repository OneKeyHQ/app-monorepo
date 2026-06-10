import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { DeviceInfo } from './adapters/types';
import type { SearchDevice } from '@onekeyfe/hd-core';

export function mapThirdPartyDeviceToSearchDevice({
  device,
  defaultDeviceName,
  canMatchDeviceByConnectId = (connectId) => Boolean(connectId),
  hasPersistentConnectId = (transport) => transport === 'ble',
  hasPersistentDeviceId = () => false,
}: {
  device: DeviceInfo;
  defaultDeviceName?: string;
  canMatchDeviceByConnectId?: (connectId: string) => boolean;
  /**
   * True if this vendor's connectId is stable across sessions on the given
   * transport. Drives whether USB connectId is preserved or dropped:
   *   - Trezor USB: serial number, stable → keep
   *   - Ledger USB: DMK-generated ephemeral UUID → drop, downstream matches
   *     by chain fingerprint instead
   */
  hasPersistentConnectId?: (transport: 'usb' | 'ble') => boolean;
  hasPersistentDeviceId?: (transport: 'usb' | 'ble') => boolean;
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
      // Vendors with a stable USB connectId (Trezor: serial number, OneKey
      // ditto) keep it. Vendors with ephemeral USB connectId (Ledger DMK)
      // null it out — downstream code matches by chain fingerprint instead.
      connectId = hasPersistentConnectId('usb') ? stableConnectId : null;
      break;
    default:
      // Transport unknown — fall back to connectId shape heuristic.
      connectId = stableConnectId;
  }

  const displayName =
    rawName && !isUuidLike(rawName)
      ? rawName
      : device.model || defaultDeviceName || '';
  const transport = device.connectionType;
  const hasStableDeviceId =
    transport === 'usb' || transport === 'ble'
      ? hasPersistentDeviceId(transport)
      : hasPersistentDeviceId('usb') || hasPersistentDeviceId('ble');
  const firmwareDeviceId = hasStableDeviceId ? device.deviceId || null : null;

  // Stash the full DeviceInfo (which itself carries `raw.features` and
  // `raw.discoveryRaw`) on the SearchDevice via a cast — `SearchDevice` is
  // a fixed type in @onekeyfe/hd-core, but consumers tolerate extra fields.
  // UI can read `item.device.raw` for debugging / future field promotion;
  // DB layer can read `item.device.raw.features` for THP context.
  return {
    connectId,
    deviceId: firmwareDeviceId,
    name: displayName,
    deviceType: 'unknown',
    uuid: '',
    commType: 'bridge',
    // Pass-through: persisted into IDBDeviceSettings.vendorModel/vendorModelName.
    vendorModel: device.model,
    vendorModelName: (device as DeviceInfo & { modelName?: string }).modelName,
    raw: {
      vendor: device.vendor,
      connectId: device.connectId,
      deviceId: device.deviceId,
      label: device.label,
      model: device.model,
      modelName: (device as DeviceInfo & { modelName?: string }).modelName,
      firmwareVersion: device.firmwareVersion,
      connectionType: device.connectionType,
      serialNumber: (device as DeviceInfo & { serialNumber?: string })
        .serialNumber,
      capabilities: device.capabilities,
      // Trezor: contains { features, discoveryRaw }; Ledger: undefined.
      vendorRaw: (device as DeviceInfo & { raw?: Record<string, unknown> }).raw,
    },
  } as SearchDevice;
}
