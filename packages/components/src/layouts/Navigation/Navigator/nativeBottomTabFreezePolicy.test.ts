import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import { shouldFreezeNativeBottomTab } from './nativeBottomTabFreezePolicy';

describe('native bottom tab freeze policy', () => {
  it('keeps the Android Wallet native view mounted while the tab is blurred', () => {
    expect(
      shouldFreezeNativeBottomTab({
        isNativeIOS: false,
        routeName: ETabRoutes.Home,
      }),
    ).toBe(false);
  });

  it('continues freezing other Android tabs', () => {
    expect(
      shouldFreezeNativeBottomTab({
        isNativeIOS: false,
        routeName: ETabRoutes.Swap,
      }),
    ).toBe(true);
  });

  it('keeps the existing iOS no-freeze behavior', () => {
    expect(
      shouldFreezeNativeBottomTab({
        isNativeIOS: true,
        routeName: ETabRoutes.Swap,
      }),
    ).toBe(false);
  });
});
