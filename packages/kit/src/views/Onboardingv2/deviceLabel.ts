import { EDeviceType } from '@onekeyfe/hd-shared';

export const getDeviceLabel = (
  deviceTypeItems: EDeviceType[],
  separator = '/',
) => {
  const labels = deviceTypeItems.map((deviceType) => {
    switch (deviceType) {
      // Pro 2 / Neo are not public yet; keep the shared OneKey Pro USB copy.
      case EDeviceType.Pro:
      case EDeviceType.Pro2:
      case EDeviceType.Neo:
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
  return Array.from(new Set(labels)).join(separator);
};
