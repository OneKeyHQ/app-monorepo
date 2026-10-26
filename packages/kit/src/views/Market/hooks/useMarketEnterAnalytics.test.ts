/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';

import { useMarketEnterAnalytics } from './useMarketEnterAnalytics';

const mockDexEnter = jest.fn();
let mockParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ key: 'detail', params: mockParams }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      enter: {
        dexEnter: (payload: unknown) => {
          mockDexEnter(payload);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));
jest.mock('../utils/marketDetailNavigation', () => {
  const actual = jest.requireActual<
    typeof import('../utils/marketDetailNavigation')
  >('../utils/marketDetailNavigation');
  return { isInitialSectionConsumed: actual.isInitialSectionConsumed };
});

describe('useMarketEnterAnalytics', () => {
  beforeEach(() => {
    mockDexEnter.mockClear();
  });

  it('records one entry when the one-shot Overview request is consumed', () => {
    mockParams = {
      stockId: 'AAPL',
      from: EEnterWay.SwapStock,
      initialSection: 'overview',
    };
    const { rerender } = renderHook(() => useMarketEnterAnalytics());
    expect(mockDexEnter).toHaveBeenCalledTimes(1);
    expect(mockDexEnter).toHaveBeenCalledWith({
      enterWay: EEnterWay.SwapStock,
    });

    mockParams = { stockId: 'AAPL', from: EEnterWay.SwapStock };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(1);

    // A real new entry still counts.
    mockParams = {
      stockId: 'AAPL',
      from: EEnterWay.SwapStock,
      initialSection: 'overview',
    };
    rerender();
    expect(mockDexEnter).toHaveBeenCalledTimes(2);
  });
});
