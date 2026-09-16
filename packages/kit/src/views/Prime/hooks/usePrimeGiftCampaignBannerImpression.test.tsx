/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

import {
  type IPrimeGiftCampaignBannerImpressionHost,
  type IPrimeGiftCampaignBannerMeasureHost,
  type IPrimeGiftCampaignBannerMeasureInWindow,
  usePrimeGiftCampaignBannerImpression,
} from './usePrimeGiftCampaignBannerImpression';

const mockShown = jest.fn();
let appVisible = true;
const visibilityListeners: ((visible: boolean) => void)[] = [];

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
  getCurrentVisibilityState: () => appVisible,
  onVisibilityStateChange: (callback: (visible: boolean) => void) => {
    visibilityListeners.push(callback);
    return () => {
      const index = visibilityListeners.indexOf(callback);
      if (index >= 0) {
        visibilityListeners.splice(index, 1);
      }
    };
  },
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
  current: IPrimeGiftCampaignBannerMeasureHost | null;
} = {
  current: null,
};

jest.mock('@onekeyhq/components', () => ({
  useScrollView: () => ({
    scrollViewRef: mockScrollViewRef,
  }),
}));

function setViewportMeasure(
  measureInWindow: IPrimeGiftCampaignBannerMeasureHost['measureInWindow'],
) {
  mockScrollViewRef.current = {
    measureInWindow,
  };
}

describe('native gift campaign banner impression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appVisible = true;
    visibilityListeners.length = 0;
    mockScrollViewRef.current = null;
    platformEnv.isNative = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = false;
  });

  it('does not count a banner clipped under the footer until it scrolls into the ScrollView viewport', () => {
    let bannerY = 720;
    const host: IPrimeGiftCampaignBannerImpressionHost = {
      measureInWindow: (callback) => {
        callback(0, bannerY, 400, 80);
      },
    };
    setViewportMeasure((callback) => {
      callback(0, 0, 400, 700);
    });
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
    const bannerCallbacks: IPrimeGiftCampaignBannerMeasureInWindow[] = [];
    const viewportCallbacks: IPrimeGiftCampaignBannerMeasureInWindow[] = [];
    const host: IPrimeGiftCampaignBannerImpressionHost = {
      measureInWindow: (callback) => {
        bannerCallbacks.push(callback);
      },
    };
    setViewportMeasure((callback) => {
      viewportCallbacks.push(callback);
    });

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

  it('calls measureInWindow on the banner and viewport hosts', () => {
    const bannerReceivers: unknown[] = [];
    const viewportReceivers: unknown[] = [];
    const host: IPrimeGiftCampaignBannerMeasureHost = {
      measureInWindow(
        this: unknown,
        callback: IPrimeGiftCampaignBannerMeasureInWindow,
      ) {
        bannerReceivers.push(this);
        callback(10, 10, 100, 80);
      },
    };
    const viewport: IPrimeGiftCampaignBannerMeasureHost = {
      measureInWindow(
        this: unknown,
        callback: IPrimeGiftCampaignBannerMeasureInWindow,
      ) {
        viewportReceivers.push(this);
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
    expect(bannerReceivers).toEqual([host]);
    expect(viewportReceivers).toEqual([viewport]);
    expect(mockShown).toHaveBeenCalledTimes(1);
  });
});
