import { EDeviceType } from '@onekeyfe/hd-shared';

export const getDeviceLabel = (
  deviceTypeItems: EDeviceType[],
  separator = '/',
) => {
  const labels = deviceTypeItems.map((deviceType) => {
    switch (deviceType) {
      case EDeviceType.Pro:
        return 'OneKey Pro';
      case EDeviceType.Pro2:
        return 'OneKey Pro 2';
      case EDeviceType.Neo:
        return 'OneKey Neo';
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
  // Shared product variants collapse to one label; keep the copy free of duplicates.
  return Array.from(new Set(labels)).join(separator);
};
