import { EDeviceType } from '@onekeyfe/hd-shared';

export const getDeviceLabel = (
  deviceTypeItems: EDeviceType[],
  separator = '/',
) => {
  const labels = deviceTypeItems.map((deviceType) => {
    switch (deviceType) {
      // Pro 2 is sold under the shared "OneKey Pro" product name, so the
      // connection copy must not spell out a separate Pro 2 entry.
      case EDeviceType.Pro:
      case EDeviceType.Pro2:
        return 'OneKey Pro';
      case EDeviceType.Classic:
        return 'OneKey Classic';
      case EDeviceType.Classic1s:
        return 'OneKey Classic 1S';
      case EDeviceType.ClassicPure:
        return '1S Pure';
      case EDeviceType.Mini:
        return 'OneKey Mini';
      case EDeviceType.Touch:
        return 'OneKey Touch';
      default:
        return deviceType;
    }
  });
  // Pro + Pro 2 collapse to the same label; keep the copy free of duplicates.
  return Array.from(new Set(labels)).join(separator);
};
