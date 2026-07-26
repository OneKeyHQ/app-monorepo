import natsort from 'natsort';

import type { SearchDevice } from '@onekeyfe/hd-core';

export type ITrezorBleBindingMode = 'manual-binding' | 'auto-fallback';

export type ITrezorBleBindingScannedDevice = SearchDevice & {
  raw?: {
    connectionType?: 'usb' | 'ble';
    deviceId?: string;
  };
};

export function getTrezorBleBindingScanOptions(mode: ITrezorBleBindingMode): {
  resetSession: boolean;
  waitForAllTransports?: boolean;
  transportType?: 'usb' | 'ble';
} {
  if (mode === 'auto-fallback') {
    return {
      resetSession: true,
      waitForAllTransports: true,
    };
  }
  return {
    resetSession: true,
    transportType: 'ble',
  };
}

export function findTrezorAutoFallbackConnectId({
  mode,
  devices,
  usbConnectId,
  featuresDeviceId,
}: {
  mode: ITrezorBleBindingMode;
  devices: ITrezorBleBindingScannedDevice[];
  usbConnectId: string;
  featuresDeviceId: string;
}): string | null {
  if (mode !== 'auto-fallback') {
    return null;
  }
  const expectedUsbIds = new Set(
    [usbConnectId, featuresDeviceId]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const usbDevices = devices.filter(
    (device) => device.raw?.connectionType === 'usb',
  );
  const normalizedFeaturesDeviceId = featuresDeviceId.trim().toLowerCase();
  const usbDeviceByDeviceId = usbDevices.find(
    (device) =>
      typeof device.raw?.deviceId === 'string' &&
      device.raw.deviceId.trim().toLowerCase() === normalizedFeaturesDeviceId,
  );
  if (usbDeviceByDeviceId?.connectId) {
    return usbDeviceByDeviceId.connectId;
  }
  const usbDevice = usbDevices.find((device) =>
    [device.connectId, device.raw?.deviceId].some(
      (value) =>
        typeof value === 'string' &&
        expectedUsbIds.has(value.trim().toLowerCase()),
    ),
  );
  return usbDevice?.connectId || null;
}

export function buildTrezorBleBindingCandidates({
  devices,
  usbConnectId,
}: {
  devices: ITrezorBleBindingScannedDevice[];
  usbConnectId: string;
}): ITrezorBleBindingScannedDevice[] {
  const candidates = devices.filter(
    (device) =>
      Boolean(device.connectId) &&
      device.connectId !== usbConnectId &&
      device.raw?.connectionType === 'ble',
  );

  return candidates.toSorted((a, b) =>
    natsort({ insensitive: true })(
      a.name || a.connectId || '',
      b.name || b.connectId || '',
    ),
  );
}

export function getTrezorBleBindingCandidateState({
  connectId,
  bindingId,
  rejectedConnectIds,
}: {
  connectId?: string | null;
  bindingId: string | null;
  rejectedConnectIds: Record<string, true>;
}) {
  const isBinding = bindingId === connectId;
  const isRejected = Boolean(connectId && rejectedConnectIds[connectId]);
  return {
    isBinding,
    isRejected,
    disabled: isRejected || Boolean(bindingId),
    drillIn: !bindingId && !isRejected,
    opacity: isRejected || (bindingId && !isBinding) ? 0.5 : 1,
  };
}
