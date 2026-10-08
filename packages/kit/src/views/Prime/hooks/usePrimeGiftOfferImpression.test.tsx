/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePrimeGiftOfferImpression } from './usePrimeGiftOfferImpression';

import type {
  IPrimeGiftOfferImpressionHost,
  IPrimeGiftOfferMeasureInWindow,
} from './usePrimeGiftOfferImpression';

const mockShown = jest.fn();
let appVisible = true;
const visibilityListeners: ((visible: boolean) => void)[] = [];

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        primeGiftOfferShown: (...args: unknown[]) => {
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

describe('native gift offer impression', () => {
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

  it('ignores a late measure after unmount and does not poll in the background', () => {
    const measureCallbacks: IPrimeGiftOfferMeasureInWindow[] = [];
    const node: IPrimeGiftOfferImpressionHost = {
      measureInWindow: (callback) => {
        measureCallbacks.push(callback);
      },
    };
    const { result, unmount } = renderHook(() =>
      usePrimeGiftOfferImpression({
        enabled: true,
        serialNo: 'DEVICE-A',
        source: 'deviceDetails',
      }),
    );
    act(() => {
      result.current(node);
    });
    const lateCallback = measureCallbacks[0];
    unmount();
    act(() => {
      lateCallback?.(10, 10, 100, 80);
    });
    expect(mockShown).not.toHaveBeenCalled();

    measureCallbacks.length = 0;
    appVisible = false;
    const background = renderHook(() =>
      usePrimeGiftOfferImpression({
        enabled: true,
        serialNo: 'DEVICE-A',
        source: 'deviceDetails',
      }),
    );
    act(() => {
      background.result.current(node);
    });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(measureCallbacks).toHaveLength(0);
    act(() => {
      visibilityListeners.forEach((listener) => listener(false));
    });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(mockShown).not.toHaveBeenCalled();
    act(() => {
      appVisible = true;
      visibilityListeners.forEach((listener) => listener(true));
      measureCallbacks.at(-1)?.(0, 900, 100, 80);
    });
    expect(mockShown).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
      measureCallbacks.at(-1)?.(10, 10, 100, 80);
      jest.advanceTimersByTime(900);
    });
    expect(mockShown).toHaveBeenCalledTimes(1);
    expect(mockShown).toHaveBeenCalledWith({ source: 'deviceDetails' });
  });
});
