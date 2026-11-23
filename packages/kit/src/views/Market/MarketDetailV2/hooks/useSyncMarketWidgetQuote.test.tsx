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
    supportsChartModeQuotes: jest.fn(() => true),
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

  it('refreshes the widget observation when the displayed day range is unchanged', () => {
    const {
      MarketSimpleChartRangeChangeProvider,
      useReportMarketSimpleChartRangeChange,
      useReportedMarketSimpleChartRange,
    } = jest.requireActual<
      typeof import('./MarketSimpleChartRangeChangeContext')
    >('./MarketSimpleChartRangeChangeContext');
    const { result } = renderHook(
      () => ({
        report: useReportMarketSimpleChartRangeChange(),
        observation: useReportedMarketSimpleChartRange(),
      }),
      { wrapper: MarketSimpleChartRangeChangeProvider },
    );
    const range: IReportedSimpleChartRange = {
      range: '1D',
      priceMode: 'token',
      baseline: 100,
      latest: 100,
      widgetScope: { ...target, observedAt: Date.now() - 60_000 },
    };
    act(() => result.current.report(range));
    expect(result.current.observation).toEqual(range);
    const refreshed: IReportedSimpleChartRange = {
      ...range,
      widgetScope: { ...target, observedAt: Date.now() },
    };
    act(() => result.current.report(refreshed));
    expect(result.current.observation).toEqual(refreshed);
  });

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
    expect(
      jest
        .mocked(marketWidget.syncQuote)
        .mock.calls.map(([{ quote }]) => quote.chartMode),
    ).toEqual(['pro', undefined, 'simple']);
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

  it('keeps rolling detail quotes on native bridges without mode-aware storage', async () => {
    jest
      .mocked(marketWidget.supportsChartModeQuotes)
      ?.mockReturnValueOnce(false);
    mockToken = {
      ...mockToken,
      price: '125',
      chartPriceMode: 'simple',
      chartPriceUpdatedAt: Date.now(),
    };
    mockRange = {
      range: '1D',
      priceMode: 'token',
      baseline: 100,
      latest: 125,
      widgetScope: { ...target, observedAt: Date.now() },
    };
    const { unmount } = renderHook(() => useSyncMarketWidgetQuote(target));
    await act(async () => undefined);
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          price: '1',
          change24h: '2',
          isDetailQuote: true,
        }),
      }),
    );
    unmount();
  });

  it('publishes a newer Pro change and the detail pair when the chart stalls', async () => {
    mockMode = 'pro';
    const chartAt = Date.now() - 1000;
    mockToken = {
      ...mockToken,
      price: '130',
      chartPriceMode: 'pro',
      chartPriceUpdatedAt: chartAt,
      widgetDetailQuote: {
        price: '100',
        change24h: '2',
        fetchedAt: chartAt - 2000,
      },
    };
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    mockToken = {
      ...mockToken,
      widgetDetailQuote: {
        price: '105',
        change24h: '3',
        fetchedAt: chartAt - 500,
      },
    };
    rerender();
    await act(async () => mockAppStateChanged?.('background'));
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          chartMode: 'pro',
          price: '130',
          change24h: '3',
          fetchedAt: chartAt,
          detailFetchedAt: chartAt - 500,
        }),
      }),
    );

    mockToken = { ...mockToken, price: '110', chartPriceMode: undefined };
    receiveDetailQuote('110', '4');
    rerender();
    await act(async () => mockAppStateChanged?.('background'));
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          price: '110',
          change24h: '4',
          isDetailQuote: true,
          proFallbackAt: Date.now(),
        }),
      }),
    );
    expect(
      jest.mocked(marketWidget.syncQuote).mock.lastCall?.[0].quote.chartMode,
    ).toBeUndefined();
    unmount();
  });

  it('uses the retained title price when switching to Pro before its first tick', async () => {
    const chartAt = Date.now() - 1000;
    mockToken = {
      ...mockToken,
      price: '125',
      chartPriceMode: 'simple',
      chartPriceUpdatedAt: chartAt,
      widgetDetailQuote: {
        price: '100',
        change24h: '2',
        fetchedAt: chartAt - 2000,
      },
    };
    mockRange = {
      range: '1D',
      priceMode: 'token',
      baseline: 100,
      latest: 125,
      widgetScope: { ...target, observedAt: chartAt },
    };
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    mockMode = 'pro';
    rerender();
    await act(async () => mockAppStateChanged?.('background'));
    expect(marketWidget.syncQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({
          chartMode: 'pro',
          price: '125',
          change24h: '2',
          fetchedAt: chartAt,
        }),
      }),
    );
    unmount();
  });

  it('preserves a queued detail fallback when the Pro chart resumes', async () => {
    mockMode = 'pro';
    const { rerender, unmount } = renderHook(() =>
      useSyncMarketWidgetQuote(target),
    );
    await act(async () => undefined);
    jest.advanceTimersByTime(1000);
    const proFallbackAt = Date.now();
    receiveDetailQuote('110', '4');
    rerender();

    jest.advanceTimersByTime(1000);
    mockToken = {
      ...mockToken,
      price: '125',
      chartPriceMode: 'pro',
      chartPriceUpdatedAt: Date.now(),
    };
    rerender();
    await act(async () => mockAppStateChanged?.('background'));
    expect(marketWidget.syncQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({ price: '110', proFallbackAt }),
      }),
    );
    expect(marketWidget.syncQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        quote: expect.objectContaining({ price: '125', chartMode: 'pro' }),
      }),
    );
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
