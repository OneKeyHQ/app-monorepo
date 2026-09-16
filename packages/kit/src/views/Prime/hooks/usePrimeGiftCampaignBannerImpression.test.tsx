/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT } from '@onekeyhq/shared/types/linkConfig';

import { usePrimeGiftCampaignBannerImpression } from './usePrimeGiftCampaignBannerImpression';

import type {
  IPrimeGiftCampaignBannerImpressionHost,
  IPrimeGiftCampaignBannerMeasureInWindow,
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

describe('native campaign banner impression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    appVisible = true;
    visibilityListeners.length = 0;
    platformEnv.isNative = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    platformEnv.isNative = false;
  });

  it('does not log until the banner is actually in the viewport', () => {
    const measureCallbacks: IPrimeGiftCampaignBannerMeasureInWindow[] = [];
    const node: IPrimeGiftCampaignBannerImpressionHost = {
      measureInWindow: (callback) => {
        measureCallbacks.push(callback);
      },
    };
    const { result } = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: true,
        slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
        linkId: 'link-a',
      }),
    );
    act(() => {
      result.current(node);
    });
    expect(mockShown).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
      measureCallbacks.at(-1)?.(0, 900, 100, 80);
    });
    expect(mockShown).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
      measureCallbacks.at(-1)?.(10, 10, 100, 80);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
    expect(mockShown).toHaveBeenCalledWith({
      slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
      linkId: 'link-a',
    });
  });

  it('does not repeat the same linkId impression on re-render', () => {
    const measureCallbacks: IPrimeGiftCampaignBannerMeasureInWindow[] = [];
    const node: IPrimeGiftCampaignBannerImpressionHost = {
      measureInWindow: (callback) => {
        measureCallbacks.push(callback);
      },
    };
    const { result, rerender } = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: true,
        slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
        linkId: 'link-a',
      }),
    );
    act(() => {
      result.current(node);
    });
    act(() => {
      jest.advanceTimersByTime(300);
      measureCallbacks.at(-1)?.(10, 10, 100, 80);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
    rerender();
    act(() => {
      jest.advanceTimersByTime(600);
      measureCallbacks.at(-1)?.(10, 10, 100, 80);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
  });

  it('does not log when the banner is not enabled', () => {
    const node: IPrimeGiftCampaignBannerImpressionHost = {
      measureInWindow: () => {},
    };
    const { result } = renderHook(() =>
      usePrimeGiftCampaignBannerImpression({
        enabled: false,
        slot: PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT,
        linkId: 'link-a',
      }),
    );
    act(() => {
      result.current(node);
    });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(mockShown).not.toHaveBeenCalled();
  });
});
