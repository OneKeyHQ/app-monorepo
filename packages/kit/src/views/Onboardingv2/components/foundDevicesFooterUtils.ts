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

// A pick that is no longer listed yields no selection (the connect button
// disables) rather than silently retargeting another device; only an empty
// pick takes the first row, and the footer commits that default to state.
export function resolveSelectedFoundDevice(
  devices: IConnectYourDeviceItem[],
  pickedKey: string | undefined,
): IConnectYourDeviceItem | undefined {
  if (pickedKey) {
    return devices.find((item) => getFoundDeviceKey(item) === pickedKey);
  }
  return devices[0];
}
