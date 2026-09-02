import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

// connectId is what the connect flow dials, so it is the natural identity of a
// scan row; BLE rows have no deviceId before their features are read.
export function getFoundDeviceKey(item: IConnectYourDeviceItem): string {
  return (
    item.device?.connectId ||
    item.device?.deviceId ||
    item.device?.uuid ||
    item.title
  );
}

// Keep the user's pick while it is still listed; otherwise fall back to the
// first (highest-priority) row so the connect button always has a target.
export function resolveSelectedFoundDevice(
  devices: IConnectYourDeviceItem[],
  pickedKey: string | undefined,
): IConnectYourDeviceItem | undefined {
  if (pickedKey) {
    const picked = devices.find(
      (item) => getFoundDeviceKey(item) === pickedKey,
    );
    if (picked) {
      return picked;
    }
  }
  return devices[0];
}
