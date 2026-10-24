/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  isSwapStockTripEnded,
  setSwapStockTripEnded,
} from '../../utils/marketDetailNavigation';

import {
  useMarketDetailBackNavigation,
  useSwapStockBackTrip,
} from './useMarketDetailBackNavigation';

const mockSwitchTab = jest.fn();
const mockPop = jest.fn();
const mockDispatch = jest.fn();
const ROUTE_KEY = 'market-stock-detail-1';
let mockTabFocusCallback: ((isFocus: boolean) => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: (payload: unknown) => ({ type: 'RESET', payload }),
  },
  useNavigation: () => ({
    getState: () => ({
      index: 0,
      routes: [{ key: ROUTE_KEY, name: 'MarketStockDetail' }],
    }),
    dispatch: mockDispatch,
  }),
  useRoute: () => ({
    key: ROUTE_KEY,
    params: { from: EEnterWay.SwapStock },
  }),
}));
jest.mock('@onekeyhq/components', () => ({
  switchTab: jest.fn(),
  useSplitSubView: () => false,
}));
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => ({
  __esModule: true,
  // Like useOnRouterChange, only the first callback is registered.
  default: (_tab: unknown, callback: (isFocus: boolean) => void) => {
    mockTabFocusCallback ??= callback;
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    switchTab: mockSwitchTab,
    pop: mockPop,
    popToTop: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

describe('useMarketDetailBackNavigation from Swap view full data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSwapStockTripEnded(ROUTE_KEY, false);
  });

  it('returns to Swap while the trip from Swap is still open', () => {
    const { result } = renderHook(() => useMarketDetailBackNavigation());
    result.current.handleBackPress();
    expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.Swap);
  });

  it('stays in Market once the user left the Market tab another way', () => {
    setSwapStockTripEnded(ROUTE_KEY, true);
    expect(isSwapStockTripEnded(ROUTE_KEY)).toBe(true);
    const { result } = renderHook(() => useMarketDetailBackNavigation());
    result.current.handleBackPress();
    expect(mockSwitchTab).not.toHaveBeenCalledWith(ETabRoutes.Swap);
  });
});

describe('useSwapStockBackTrip', () => {
  const navigation = {
    addListener: jest.fn(() => () => undefined),
    dispatch: jest.fn(),
  };
  const fromSwap = { stockId: 'AAPL', from: EEnterWay.SwapStock };

  beforeEach(() => {
    mockTabFocusCallback = undefined;
    setSwapStockTripEnded(ROUTE_KEY, false);
  });

  function renderTrip(initial: { params: object; isFromSwapStock: boolean }) {
    return renderHook(
      (props: { params: object; isFromSwapStock: boolean }) =>
        useSwapStockBackTrip({
          navigation,
          routeKey: ROUTE_KEY,
          isChartFullscreen: false,
          ...props,
        }),
      { initialProps: initial },
    );
  }

  it('ends the trip of a reused detail that Swap reopened', () => {
    // Opened from the Market list first, then reused by "view full data".
    const { rerender } = renderTrip({
      params: { stockId: 'AAPL' },
      isFromSwapStock: false,
    });
    rerender({
      params: { ...fromSwap, initialSection: 'overview' },
      isFromSwapStock: true,
    });
    act(() => mockTabFocusCallback?.(true));
    act(() => mockTabFocusCallback?.(false));
    expect(isSwapStockTripEnded(ROUTE_KEY)).toBe(true);
  });

  it('keeps the Market tab history when the Overview request is consumed', () => {
    const { rerender } = renderTrip({
      params: { ...fromSwap, initialSection: 'overview' },
      isFromSwapStock: true,
    });
    act(() => mockTabFocusCallback?.(true));
    rerender({ params: { ...fromSwap }, isFromSwapStock: true });
    act(() => mockTabFocusCallback?.(false));
    expect(isSwapStockTripEnded(ROUTE_KEY)).toBe(true);
  });

  it('restarts the trip on a new entry from Swap', () => {
    const { rerender } = renderTrip({
      params: { ...fromSwap, initialSection: 'overview' },
      isFromSwapStock: true,
    });
    act(() => mockTabFocusCallback?.(true));
    act(() => mockTabFocusCallback?.(false));
    expect(isSwapStockTripEnded(ROUTE_KEY)).toBe(true);
    rerender({
      params: { ...fromSwap, initialSection: 'overview' },
      isFromSwapStock: true,
    });
    expect(isSwapStockTripEnded(ROUTE_KEY)).toBe(false);
  });
});
