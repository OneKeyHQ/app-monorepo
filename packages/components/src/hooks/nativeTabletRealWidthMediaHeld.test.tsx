/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import {
  acquireNativeTabletRealWidthMedia,
  releaseNativeTabletRealWidthMedia,
  useIsNativeTabletRealWidthMediaHeld,
} from './nativeTabletRealWidthMedia.native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSPad: true },
}));

describe('useIsNativeTabletRealWidthMediaHeld', () => {
  afterEach(() => {
    delete globalThis.$$onekeyNativeMedia;
  });

  it('updates subscribers only when the first holder acquires and the last releases', () => {
    const { result } = renderHook(() => useIsNativeTabletRealWidthMediaHeld());
    expect(result.current).toBe(false);

    act(() => {
      acquireNativeTabletRealWidthMedia();
    });
    expect(result.current).toBe(true);

    act(() => {
      acquireNativeTabletRealWidthMedia();
      releaseNativeTabletRealWidthMedia();
    });
    expect(result.current).toBe(true);

    act(() => {
      releaseNativeTabletRealWidthMedia();
    });
    expect(result.current).toBe(false);

    act(() => {
      releaseNativeTabletRealWidthMedia();
    });
    expect(result.current).toBe(false);
  });
});
