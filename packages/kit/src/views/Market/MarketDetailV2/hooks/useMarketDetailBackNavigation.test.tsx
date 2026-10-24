/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import {
  isSwapStockTripEnded,
  setSwapStockTripEnded,
} from '../../utils/marketDetailNavigation';

import { useMarketDetailBackNavigation } from './useMarketDetailBackNavigation';

const mockSwitchTab = jest.fn();
const mockPop = jest.fn();
const mockDispatch = jest.fn();
const ROUTE_KEY = 'market-stock-detail-1';

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
jest.mock('@onekeyhq/components', () => ({ useSplitSubView: () => false }));
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
