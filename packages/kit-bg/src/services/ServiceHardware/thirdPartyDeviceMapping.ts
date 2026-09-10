import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { getThirdPartyDeviceDisplayName } from '@onekeyhq/shared/src/utils/thirdPartyDeviceName';
import type {
  EHardwareVendor,
  IThirdPartyHardwareSearchTarget,
} from '@onekeyhq/shared/types/device';

import type { DeviceInfo } from './adapters/types';
import type { SearchDevice } from '@onekeyfe/hd-core';

type IThirdPartySearchTransport = 'usb' | 'ble' | 'qr';

export function mapThirdPartySearchTargetToSearchDevice({
  target,
  defaultDeviceName,
}: {
  target: IThirdPartyHardwareSearchTarget;
  defaultDeviceName?: string;
}): SearchDevice {
  const canReconnectWithoutDiscovery =
    target.searchTargetReusePolicy === 'reconnectable';
  return {
    connectId:
      canReconnectWithoutDiscovery && target.searchTargetId
        ? target.searchTargetId
        : null,
    deviceId: null,
    name: getThirdPartyDeviceDisplayName({
      brand:
        defaultDeviceName || getVendorProfile(target.vendor).defaultDeviceName,
      modelName: target.modelName,
      model: target.model,
      name: target.label,
    }),
    deviceType: 'unknown',
    uuid: '',
    commType: 'bridge',
    vendor: target.vendor,
    vendorModel: target.model,
    vendorModelName: target.modelName,
    raw: {
      vendor: target.vendor,
      connectId: target.searchTargetId,
      deviceId: '',
      label: target.label,
      model: target.model,
      modelName: target.modelName,
      connectionType: target.connectionType,
      serialNumber: target.serialNumber,
      searchTarget: target,
    },
  } as SearchDevice;
}

export function normalizeThirdPartySearchDevicesForTransport({
  devices,
  transportType,
}: {
  devices: DeviceInfo[];
  transportType: IThirdPartySearchTransport;
}): DeviceInfo[] {
  return devices.flatMap((device) => {
    const availableChannels = (
      device as DeviceInfo & {
        raw?: { availableChannels?: unknown };
      }
    ).raw?.availableChannels;
    const supportsRequestedTransport =
      device.connectionType === transportType ||
      (Array.isArray(availableChannels) &&
        availableChannels.includes(transportType));

    if (!supportsRequestedTransport) {
      return [];
    }

    // A multi-channel Keystone record reports USB while a live USB session is
    // attached. Preserve the transport selected for this operation so
    // analytics and DB transport handles do not misclassify QR as USB.
    return [{ ...device, connectionType: transportType }];
  });
}

export function mapThirdPartyDeviceToSearchDevice({
  device,
  defaultDeviceName,
  canMatchDeviceByConnectId,
  hasPersistentConnectId,
  hasPersistentDeviceId,
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
  const profile = getVendorProfile(device.vendor as EHardwareVendor);
  const rawName =
    device.label || (device as DeviceInfo & { name?: string }).name || '';
  const stableConnectId =
    device.connectId &&
    (canMatchDeviceByConnectId?.(device.connectId) ??
      profile.canMatchDeviceByConnectId(device.connectId))
      ? device.connectId
      : null;
  const connectorClaimsPersistentIdentity =
    device.capabilities?.persistentDeviceIdentity;

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
      connectId =
        (connectorClaimsPersistentIdentity ??
        hasPersistentConnectId?.('usb') ??
        profile.hasPersistentConnectId('usb'))
          ? stableConnectId
          : null;
      break;
    default:
      // Transport unknown — fall back to connectId shape heuristic.
      connectId = stableConnectId;
  }

  const displayName = getThirdPartyDeviceDisplayName({
    brand: defaultDeviceName || profile.defaultDeviceName,
    modelName: (device as DeviceInfo & { modelName?: string }).modelName,
    model: device.model,
    name: rawName,
  });
  const resolvePersistentDeviceId = (transport: 'usb' | 'ble') =>
    hasPersistentDeviceId?.(transport) ??
    profile.hasPersistentDeviceId(transport);
  const transport = device.connectionType;
  const hasStableDeviceId =
    transport === 'usb' || transport === 'ble'
      ? resolvePersistentDeviceId(transport)
      : resolvePersistentDeviceId('usb') || resolvePersistentDeviceId('ble');
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
    // Top-level vendor is load-bearing: onboarding casts this SearchDevice to
    // IDBDevice, and withHardwareProcessing routes third-party devices by
    // `device.vendor ?? device.settings.vendor` — neither exists pre-persist.
    vendor: device.vendor,
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
