import { EDeviceType } from '@onekeyfe/hd-shared';

const SHARED_PRO_FAMILY_TYPES = new Set([
  EDeviceType.Pro,
  EDeviceType.Pro2,
  EDeviceType.Neo,
]);

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
  // The shared OneKey Pro onboarding entry still routes Pro / Pro 2 / Neo
  // together. Keep that USB copy on the card name instead of concatenating.
  if (
    deviceTypeItems.length > 1 &&
    deviceTypeItems.every((deviceType) =>
      SHARED_PRO_FAMILY_TYPES.has(deviceType),
    )
  ) {
    return 'OneKey Pro';
  }
  return Array.from(new Set(labels)).join(separator);
};
