/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import {
  getMarketTokenDetailNavigationTargetFromHash,
  useExtensionMarketTokenDetailHashNavigation,
} from './useExtensionMarketTokenDetailHashNavigation';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiExpandTab: true,
  },
}));

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: undefined,
  },
}));

const mockRootNavigationRef = rootNavigationRef as unknown as {
  current:
    | {
        navigate: jest.Mock;
        getCurrentRoute: jest.Mock;
      }
    | undefined;
};

let hashChangeHandler: (() => void) | undefined;
let originalAddEventListener: typeof globalThis.addEventListener | undefined;
let originalRemoveEventListener:
  | typeof globalThis.removeEventListener
  | undefined;

function setHash(hash: string) {
  globalThis.history.replaceState(null, '', hash);
}

function triggerHashChange(hash: string) {
  setHash(hash);
  hashChangeHandler?.();
}

describe('useExtensionMarketTokenDetailHashNavigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    hashChangeHandler = undefined;
    originalAddEventListener = globalThis.addEventListener;
    originalRemoveEventListener = globalThis.removeEventListener;
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: jest.fn(
        (type: string, listener: EventListenerOrEventListenerObject | null) => {
          if (type === 'hashchange' && typeof listener === 'function') {
            const eventListener: EventListener = listener;
            hashChangeHandler = () => {
              eventListener(new HashChangeEvent('hashchange'));
            };
          }
        },
      ),
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: jest.fn((type: string) => {
        if (type === 'hashchange') {
          hashChangeHandler = undefined;
        }
      }),
    });
    setHash('#/');
    mockRootNavigationRef.current = {
      navigate: jest.fn(),
      getCurrentRoute: jest.fn(),
    };
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      value: originalAddEventListener,
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      value: originalRemoveEventListener,
    });
    jest.useRealTimers();
  });

  it('parses market token detail hash', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/bsc/0xabc?isNative=false&from=ExtensionSidePanel',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'bsc',
        tokenAddress: '0xabc',
        isNative: false,
        from: 'ExtensionSidePanel',
      },
    });
  });

  it('parses native market detail hash', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/btc--0/?isNative=true',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network: 'btc--0',
        isNative: true,
      },
    });
  });

  it('preserves native token address when the hash includes one', () => {
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/btc--0/0xnative?isNative=true&from=ExtensionSidePanel',
      ),
    ).toEqual({
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'btc--0',
        tokenAddress: '0xnative',
        isNative: true,
        from: 'ExtensionSidePanel',
      },
    });
  });

  it('ignores unrelated or malformed hash', () => {
    expect(getMarketTokenDetailNavigationTargetFromHash('#/')).toBeUndefined();
    expect(
      getMarketTokenDetailNavigationTargetFromHash(
        '#/market/token/%E0%A4%A/0xabc',
      ),
    ).toBeUndefined();
  });

  it('navigates to market detail from current hash on mount', () => {
    setHash('#/market/token/eth/0xabc?isNative=false');

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
            isNative: false,
          },
        },
      },
    );
  });

  it('retries the same hash for a short window only', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(120);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(360);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(3);

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabRoutes.Home,
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(3);
  });

  it('stops retrying once the target detail route is active', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
      },
    });
    act(() => {
      jest.advanceTimersByTime(120);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);
  });

  it('starts a new navigation run on hash change', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(1);

    act(() => {
      triggerHashChange('#/market/token/bsc/0xdef');
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenLastCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'bsc',
            tokenAddress: '0xdef',
          },
        },
      },
    );
  });

  it('navigates again after leaving and reopening the same token hash', () => {
    setHash('#/market/token/eth/0xabc');
    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabMarketRoutes.MarketDetailV2,
      params: {
        network: 'eth',
        tokenAddress: '0xabc',
      },
    });
    act(() => {
      jest.advanceTimersByTime(120);
    });

    act(() => {
      triggerHashChange('#/');
    });

    mockRootNavigationRef.current?.getCurrentRoute.mockReturnValue({
      name: ETabRoutes.Home,
    });
    act(() => {
      triggerHashChange('#/market/token/eth/0xabc');
    });

    expect(mockRootNavigationRef.current?.navigate).toHaveBeenCalledTimes(2);
    expect(mockRootNavigationRef.current?.navigate).toHaveBeenLastCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
          },
        },
      },
    );
  });

  it('retries when navigation becomes ready during the retry window', () => {
    setHash('#/market/token/eth/0xabc');
    mockRootNavigationRef.current = undefined;

    renderHook(() => useExtensionMarketTokenDetailHashNavigation());

    expect(mockRootNavigationRef.current).toBeUndefined();

    mockRootNavigationRef.current = {
      navigate: jest.fn(),
      getCurrentRoute: jest.fn(),
    };
    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(mockRootNavigationRef.current.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            network: 'eth',
            tokenAddress: '0xabc',
          },
        },
      },
    );
  });
});
