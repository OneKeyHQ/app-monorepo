/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

import { usePrimeGiftCampaignBannerImpression } from './usePrimeGiftCampaignBannerImpression';

import type { View } from 'react-native';

type INativeMeasureCallback = Parameters<View['measureInWindow']>[0];
type INativeMeasureHost = Pick<View, 'measureInWindow'>;

const mockShown = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftClaimSuccessBannerShown: (...args: unknown[]) => {
          mockShown(...args);
        },
      },
    },
  },
}));

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
}));

jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native') as object;
  return {
    ...ReactNative,
    Dimensions: {
      get: () => ({ width: 400, height: 800 }),
    },
  };
});

const mockScrollViewRef: {
  current: INativeMeasureHost | null;
} = {
  current: null,
};

jest.mock('@onekeyhq/components', () => ({
  useScrollView: () => ({
    scrollViewRef: mockScrollViewRef,
  }),
}));

describe('native gift campaign banner impression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockScrollViewRef.current = null;
    platformEnv.isNative = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = false;
  });

  it('does not count a banner clipped under the footer until it scrolls into the ScrollView viewport', () => {
    let bannerY = 720;
    const host: INativeMeasureHost = {
      measureInWindow(callback) {
        expect(this).toBe(host);
        callback(0, bannerY, 400, 80);
      },
    };
    const viewport: INativeMeasureHost = {
      measureInWindow(callback) {
        expect(this).toBe(viewport);
        callback(0, 0, 400, 700);
      },
    };
    mockScrollViewRef.current = viewport;
    const { result } = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: true,
        linkId: 'campaign-1',
      }),
    );
    act(() => {
      result.current(host);
    });
    expect(mockShown).not.toHaveBeenCalled();

    bannerY = 620;
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
    expect(mockShown).toHaveBeenCalledWith({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: 'campaign-1',
    });

    bannerY = 10;
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
  });

  it('ignores stale banner and viewport measures after unmount', () => {
    const bannerCallbacks: INativeMeasureCallback[] = [];
    const viewportCallbacks: INativeMeasureCallback[] = [];
    const host: INativeMeasureHost = {
      measureInWindow(callback) {
        bannerCallbacks.push(callback);
      },
    };
    mockScrollViewRef.current = {
      measureInWindow(callback) {
        viewportCallbacks.push(callback);
      },
    };

    const first = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: true,
        linkId: 'campaign-1',
      }),
    );
    act(() => {
      first.result.current(host);
    });
    expect(bannerCallbacks).toHaveLength(1);
    const lateBanner = bannerCallbacks[0];
    first.unmount();
    act(() => {
      lateBanner(10, 10, 100, 80);
    });
    expect(viewportCallbacks).toHaveLength(0);
    expect(mockShown).not.toHaveBeenCalled();

    bannerCallbacks.length = 0;
    const second = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: true,
        linkId: 'campaign-1',
      }),
    );
    act(() => {
      second.result.current(host);
    });
    expect(bannerCallbacks).toHaveLength(1);
    act(() => {
      bannerCallbacks[0](10, 10, 100, 80);
    });
    expect(viewportCallbacks).toHaveLength(1);
    const lateViewport = viewportCallbacks[0];
    second.unmount();
    act(() => {
      lateViewport(0, 0, 400, 700);
      jest.advanceTimersByTime(900);
    });
    expect(mockShown).not.toHaveBeenCalled();
    expect(bannerCallbacks).toHaveLength(1);
  });
});
