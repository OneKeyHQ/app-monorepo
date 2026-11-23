/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { useSyncMarketWidgetQuote } from './useSyncMarketWidgetQuote.native';

import type { AppStateStatus } from 'react-native';

let mockMasked = false;
let mockToken: IMarketTokenDetail;
let mockAppStateChanged: ((state: AppStateStatus) => void) | undefined;
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (
      _event: string,
      listener: (state: AppStateStatus) => void,
    ) => {
      mockAppStateChanged = listener;
      return { remove: jest.fn() };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    supportsQuoteSync: jest.fn(() => true),
    syncQuote: jest.fn(async () => true),
  },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget/diagnostics', () => ({
  logMarketWidgetEvent: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    ready: Promise.resolve(),
    isMaskingDataSync: () => mockMasked,
  },
}));
jest.mock('./useTokenDetail', () => ({
  useTokenDetail: () => ({ tokenDetail: mockToken }),
}));
jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => ({ isStockRoute: false }),
}));
const target = {
  active: true,
  networkId: 'evm--1',
  tokenAddress: '0xabc',
  isNative: false,
};

describe('native widget quote synchronization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAppStateChanged = undefined;
    mockMasked = false;
    mockToken = {
      networkId: 'evm--1',
      address: '0xabc',
      name: 'Token',
      symbol: 'T',
      logoUrl: '',
      decimals: 18,
      price: '1',
      priceConverted: '7',
      priceObservedAt: Date.now(),
    };
  });
  afterEach(() => jest.useRealTimers());

  it('syncs immediately, coalesces ticks and flushes the latest price when backgrounded', async () => {
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    for (const price of ['2', '3']) {
      mockToken = { ...mockToken, price };
      rerender();
    }
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockAppStateChanged?.('background');
    });
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({ price: '3' }),
      }),
    );
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not send a queued quote after privacy masking', async () => {
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    mockToken = { ...mockToken, price: '2' };
    rerender();
    mockMasked = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('flushes on route blur and safely ignores an older native binary', async () => {
    const { rerender, unmount } = renderHook(
      ({ active }) => useSyncMarketWidgetQuote({ ...target, active }),
      { initialProps: { active: true } },
    );
    await act(async () => undefined);
    mockToken = { ...mockToken, price: '2' };
    rerender({ active: true });
    await act(async () => {
      rerender({ active: false });
    });
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(2);
    unmount();
    jest.mocked(marketWidget.supportsQuoteSync).mockReturnValueOnce(false);
    const old = renderHook(() => useSyncMarketWidgetQuote(target));
    await act(async () => undefined);
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(2);
    old.unmount();
  });
});
