import { EDeviceType } from '@onekeyfe/hd-shared';

import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils.getHomeScreenServerDeviceType', () => {
  it('maps Pro 2 to Pro for the homescreen service', () => {
    expect(
      serviceHardwareUtils.getHomeScreenServerDeviceType(EDeviceType.Pro2),
    ).toBe(EDeviceType.Pro);
  });

  it('keeps other device types unchanged', () => {
    expect(
      serviceHardwareUtils.getHomeScreenServerDeviceType(EDeviceType.Touch),
    ).toBe(EDeviceType.Touch);
  });
});

describe('serviceHardwareUtils.getPro2HomeScreenSizeFallback', () => {
  it('returns the Pro 2 wallpaper dimensions when the SDK has no config', () => {
    expect(
      serviceHardwareUtils.getPro2HomeScreenSizeFallback({
        deviceType: EDeviceType.Pro2,
        thumbnail: false,
      }),
    ).toEqual({ width: 604, height: 1024 });
  });

  it('does not provide a legacy thumbnail size', () => {
    expect(
      serviceHardwareUtils.getPro2HomeScreenSizeFallback({
        deviceType: EDeviceType.Pro2,
        thumbnail: true,
      }),
    ).toBeUndefined();
  });
});

describe('serviceHardwareUtils.getPro2NftSizeFallback', () => {
  it('returns the Pro 2 NFT image and thumbnail dimensions independently', () => {
    expect(
      serviceHardwareUtils.getPro2NftSizeFallback({
        deviceType: EDeviceType.Pro2,
        thumbnail: false,
      }),
    ).toEqual({ width: 540, height: 540 });
    expect(
      serviceHardwareUtils.getPro2NftSizeFallback({
        deviceType: EDeviceType.Pro2,
        thumbnail: true,
      }),
    ).toEqual({ width: 263, height: 263 });
  });

  it('does not apply the Pro 2 fallback to legacy devices', () => {
    expect(
      serviceHardwareUtils.getPro2NftSizeFallback({
        deviceType: EDeviceType.Pro,
        thumbnail: false,
      }),
    ).toBeUndefined();
  });
});
