/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { useSyncMarketWidgetQuote } from './useSyncMarketWidgetQuote.native';

import type { IReportedSimpleChartRange } from './MarketSimpleChartRangeChangeContext';
import type { AppStateStatus } from 'react-native';

let mockMasked = false;
let mockToken: IMarketTokenDetail;
let mockMode: 'simple' | 'pro' = 'simple';
let mockRange: IReportedSimpleChartRange | undefined;
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
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailChartDisplayModePersistAtom: () => [{ mode: mockMode }],
}));
jest.mock('./MarketSimpleChartRangeChangeContext', () => ({
  ...jest.requireActual<typeof import('./MarketSimpleChartRangeChangeContext')>(
    './MarketSimpleChartRangeChangeContext',
  ),
  useReportedMarketSimpleChartRange: () => mockRange,
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

function receiveDetailQuote(price: string, change24h?: string) {
  mockToken = {
    ...mockToken,
    widgetDetailQuote: { price, change24h, fetchedAt: Date.now() },
  };
}

describe('native widget quote synchronization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAppStateChanged = undefined;
    mockMasked = false;
    mockMode = 'simple';
    mockRange = undefined;
    mockToken = {
      networkId: 'evm--1',
      address: '0xabc',
      name: 'Token',
      symbol: 'T',
      logoUrl: '',
      decimals: 18,
      price: '1',
      priceConverted: '7',
    };
    receiveDetailQuote('1', '2');
  });
  afterEach(() => jest.useRealTimers());

  it('flushes the latest detail pair when there is no chart quote in the active mode', async () => {
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    for (const price of ['20', '30']) {
      mockToken = { ...mockToken, price };
      rerender();
    }
    await act(async () => {
      mockAppStateChanged?.('background');
    });
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    receiveDetailQuote('2', '3');
    rerender();
    receiveDetailQuote('3', '4');
    rerender();
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockAppStateChanged?.('background');
    });
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          price: '3',
          change24h: '4',
          isDetailQuote: true,
        }),
      }),
    );
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('publishes the selected mode price and change together on return to the home screen', async () => {
    mockMode = 'pro';
    mockToken = {
      ...mockToken,
      price: '130',
      chartPriceMode: 'pro',
      chartPriceUpdatedAt: Date.now(),
    };
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          chartMode: 'pro',
          price: '130',
          change24h: '2',
        }),
      }),
    );

    mockMode = 'simple';
    mockRange = {
      range: '1D',
      priceMode: 'token',
      baseline: 100,
      latest: 110,
      widgetScope: { ...target, observedAt: Date.now() },
    };
    rerender();
    mockToken = {
      ...mockToken,
      price: '110',
      chartPriceMode: 'simple',
      chartPriceUpdatedAt: Date.now(),
    };
    rerender();
    await act(async () => {
      mockAppStateChanged?.('background');
    });
    expect(marketWidget.syncQuote).toHaveBeenCalledTimes(2);
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          chartMode: 'simple',
          price: '110',
          change24h: '10',
        }),
      }),
    );
    unmount();
  });

  it('does not send a queued quote after privacy masking', async () => {
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    receiveDetailQuote('2');
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
    receiveDetailQuote('2');
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
