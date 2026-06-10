import natsort from 'natsort';

import type { SearchDevice } from '@onekeyfe/hd-core';

export type ITrezorBleBindingScannedDevice = SearchDevice & {
  raw?: { connectionType?: 'usb' | 'ble' };
};

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
