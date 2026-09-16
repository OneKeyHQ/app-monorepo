/** @jest-environment jsdom */

import { Suspense, startTransition } from 'react';

import { act, render, screen } from '@testing-library/react';
import { createStore } from 'jotai';

import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  ProviderJotaiContextMarketV2,
  tokenDetailAtom,
  tokenDetailPreviewAtom,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketTradingView } from './MarketTradingView';

import type { IMarketTradingViewProps } from './MarketTradingView';

let mockOnPriceUpdate: (data: ITradingViewPriceUpdateData) => void;
const mockChartRender = jest.fn();
let mockSuspendedTokenAddress: string | undefined;
const mockPendingChart = new Promise<void>(() => undefined);
let cacheKeyId = 0;

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV2', () => ({
  TRADING_VIEW_DISABLED_FEATURES: {},
  TradingViewV2: ({
    onPriceUpdate,
    tokenAddress,
  }: {
    onPriceUpdate: typeof mockOnPriceUpdate;
    tokenAddress: string;
  }) => {
    mockChartRender();
    mockOnPriceUpdate = onPriceUpdate;
    if (tokenAddress === mockSuspendedTokenAddress) {
      throw mockPendingChart;
    }
    return null;
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../InformationTabs/hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({ accountAddress: undefined }),
}));

jest.mock('./MarketChartFullscreenHeader', () => ({
  MarketChartFullscreenHeader: () => null,
}));

const chartProps = {
  networkId: 'evm--4663',
  tokenAddress: '0x3ba500f1ababbcf0f0247d06d1c56fd7e6c4c09d',
  dataSource: 'websocket' as const,
};
const receivedAt = 1_789_531_200_000;
const detail: IMarketTokenDetail = {
  address: chartProps.tokenAddress,
  networkId: chartProps.networkId,
  name: 'Worm',
  symbol: 'WORM',
  decimals: 18,
  logoUrl: '',
  price: '0.002908',
  lastUpdated: receivedAt - 1000,
};
const latestPrice: ITradingViewPriceUpdateData = {
  networkId: chartProps.networkId,
  tokenAddress: chartProps.tokenAddress,
  price: '0.002930',
  timestamp: receivedAt - 900_000,
  interval: '15m',
  source: 'history',
};

function PriceHeader({ cacheKey }: { cacheKey: string }) {
  const [tokenDetail] = useTokenDetailAtom();
  const price = useTokenPrice({
    cacheKey,
    name: tokenDetail?.name ?? '',
    symbol: tokenDetail?.symbol ?? '',
    price: tokenDetail?.price ?? '-',
    lastUpdated: tokenDetail?.lastUpdated ?? 0,
  });
  return <div data-testid="token-price-header">{price}</div>;
}

function renderChart({
  initialDetail = detail,
  props = chartProps,
}: {
  initialDetail?: IMarketTokenDetail | null;
  props?: IMarketTradingViewProps;
} = {}) {
  const store = createStore();
  store.set(tokenDetailAtom(), initialDetail ?? undefined);
  if (!initialDetail) {
    store.set(tokenDetailPreviewAtom(), {
      address: chartProps.tokenAddress,
      networkId: chartProps.networkId,
      name: detail.name,
      symbol: detail.symbol,
      decimals: detail.decimals,
      price: Number(detail.price),
      selectedAt: receivedAt - 1000,
    });
  }
  cacheKeyId += 1;
  const cacheKey = `web-chart-price-${cacheKeyId}`;
  const buildView = (nextProps: IMarketTradingViewProps) => (
    <ProviderJotaiContextMarketV2 store={store}>
      <Suspense fallback={<div data-testid="chart-loading" />}>
        <MarketTradingView {...nextProps} />
        <PriceHeader cacheKey={cacheKey} />
      </Suspense>
    </ProviderJotaiContextMarketV2>
  );
  const view = render(buildView(props));
  return {
    store,
    unmount: view.unmount,
    rerender: (nextProps: IMarketTradingViewProps) =>
      view.rerender(buildView(nextProps)),
  };
}

function expectHeaderPrice(price: string) {
  act(() => jest.advanceTimersByTime(500));
  expect(screen.getByTestId('token-price-header').textContent).toBe(price);
}

describe('MarketTradingView price synchronization', () => {
  beforeEach(() => {
    mockChartRender.mockClear();
    mockSuspendedTokenAddress = undefined;
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(receivedAt);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('updates header prices without rerendering the chart subtree', () => {
    const { store } = renderChart({
      props: { ...chartProps, nativeControlsLayoutMode: 'desktop' },
    });
    const initialRenderCount = mockChartRender.mock.calls.length;

    act(() => mockOnPriceUpdate(latestPrice));
    const onPriceUpdate = mockOnPriceUpdate;
    for (const price of ['0.003001', '0.003001', '0.003002']) {
      act(() => onPriceUpdate({ ...latestPrice, source: 'realtime', price }));
    }

    expectHeaderPrice('0.003002');
    expect(store.get(tokenDetailAtom())?.price).toBe('0.003002');
    expect(mockChartRender).toHaveBeenCalledTimes(initialRenderCount);
  });

  it('keeps the committed chart updating while a token switch is suspended', () => {
    const { store, rerender } = renderChart();
    const committedOnPriceUpdate = mockOnPriceUpdate;
    const suspendedTokenAddress = 'suspended-token';
    mockSuspendedTokenAddress = suspendedTokenAddress;

    act(() => {
      startTransition(() => {
        rerender({ ...chartProps, tokenAddress: suspendedTokenAddress });
      });
    });
    expect(screen.queryByTestId('chart-loading')).toBeNull();

    act(() => committedOnPriceUpdate({ ...latestPrice, source: 'realtime' }));

    expect(store.get(tokenDetailAtom())?.price).toBe('0.002930');
    expectHeaderPrice('0.002930');
  });

  it('stops replaying buffered prices and ignores callbacks after unmount', () => {
    const { store, unmount } = renderChart({ initialDetail: null });
    const previousOnPriceUpdate = mockOnPriceUpdate;
    act(() => previousOnPriceUpdate(latestPrice));
    unmount();

    act(() => {
      store.set(tokenDetailAtom(), detail);
      previousOnPriceUpdate({ ...latestPrice, source: 'realtime' });
    });

    expect(store.get(tokenDetailAtom())).toEqual(detail);
  });

  it('syncs the initial snapshot even when its candle timestamp predates the API price', () => {
    const { store } = renderChart();

    act(() => mockOnPriceUpdate(latestPrice));

    expect(store.get(tokenDetailAtom())).toMatchObject({
      price: '0.002930',
      lastUpdated: receivedAt,
    });
    expectHeaderPrice('0.002930');
  });

  it('advances the header cache for realtime ticks received in the same millisecond and candle', () => {
    const { store } = renderChart({
      initialDetail: { ...detail, lastUpdated: receivedAt },
    });
    act(() => mockOnPriceUpdate(latestPrice));
    expectHeaderPrice('0.002930');

    act(() =>
      mockOnPriceUpdate({
        ...latestPrice,
        source: 'realtime',
        price: 0.003_001,
      }),
    );

    expect(store.get(tokenDetailAtom())).toMatchObject({
      price: '0.003001',
      lastUpdated: receivedAt + 2,
    });
    expectHeaderPrice('0.003001');
  });

  it('does not roll back a realtime price when history arrives late', () => {
    const { store } = renderChart();
    act(() => {
      mockOnPriceUpdate({
        ...latestPrice,
        source: 'realtime',
        price: '0.003001',
      });
      mockOnPriceUpdate({ ...latestPrice, timestamp: receivedAt + 1000 });
    });

    expect(store.get(tokenDetailAtom())?.price).toBe('0.003001');
    expectHeaderPrice('0.003001');
  });

  it('replays the snapshot when token details arrive after the preview-mounted chart', () => {
    const { store } = renderChart({ initialDetail: null });
    const initialRenderCount = mockChartRender.mock.calls.length;
    act(() => mockOnPriceUpdate(latestPrice));
    expect(store.get(tokenDetailAtom())).toBeUndefined();

    act(() => store.set(tokenDetailAtom(), detail));

    expect(store.get(tokenDetailAtom())?.price).toBe('0.002930');
    expectHeaderPrice('0.002930');
    expect(mockChartRender).toHaveBeenCalledTimes(initialRenderCount);
  });

  it('buffers the latest realtime price without letting delayed history replace it', () => {
    const { store } = renderChart({ initialDetail: null });
    act(() => {
      mockOnPriceUpdate(latestPrice);
      mockOnPriceUpdate({
        ...latestPrice,
        source: 'realtime',
        price: '0.003001',
      });
      mockOnPriceUpdate({
        ...latestPrice,
        source: 'realtime',
        price: '0.003002',
      });
      mockOnPriceUpdate(latestPrice);
    });
    act(() => store.set(tokenDetailAtom(), detail));

    expect(store.get(tokenDetailAtom())?.price).toBe('0.003002');
    expectHeaderPrice('0.003002');
  });

  it.each([
    { networkId: chartProps.networkId, tokenAddress: 'another-token' },
    { networkId: 'evm--1', tokenAddress: chartProps.tokenAddress },
  ])(
    'discards buffered prices and late callbacks when switching identity: %j',
    (identity) => {
      const { store, rerender } = renderChart({ initialDetail: null });
      act(() => mockOnPriceUpdate(latestPrice));
      const previousOnPriceUpdate = mockOnPriceUpdate;
      rerender({ ...chartProps, ...identity });
      const nextDetail = {
        ...detail,
        address: identity.tokenAddress,
        networkId: identity.networkId,
      };
      act(() => {
        store.set(tokenDetailAtom(), nextDetail);
        previousOnPriceUpdate({
          ...latestPrice,
          source: 'realtime',
          price: '9',
        });
      });
      expect(store.get(tokenDetailAtom())).toEqual(nextDetail);

      act(() =>
        mockOnPriceUpdate({ ...latestPrice, ...identity, price: '0.003005' }),
      );
      expectHeaderPrice('0.003005');
    },
  );

  it('accepts the next token snapshot after the previous token received realtime data', () => {
    const { store, rerender } = renderChart();
    act(() => mockOnPriceUpdate({ ...latestPrice, source: 'realtime' }));
    const tokenAddress = 'another-token';
    rerender({ ...chartProps, tokenAddress });
    act(() =>
      store.set(tokenDetailAtom(), { ...detail, address: tokenAddress }),
    );
    act(() =>
      mockOnPriceUpdate({ ...latestPrice, tokenAddress, price: '0.003005' }),
    );

    expectHeaderPrice('0.003005');
  });

  it('clears pending prices when chart price updates are disabled', () => {
    const { store, rerender } = renderChart({ initialDetail: null });
    act(() => mockOnPriceUpdate(latestPrice));
    rerender({ ...chartProps, disableChartPriceUpdate: true });
    act(() => store.set(tokenDetailAtom(), detail));
    rerender(chartProps);

    expect(store.get(tokenDetailAtom())).toEqual(detail);
  });

  it.each(['history', 'realtime'] as const)(
    'ignores %s prices when chart price updates are disabled',
    (source) => {
      const { store } = renderChart({
        props: { ...chartProps, disableChartPriceUpdate: true },
      });
      act(() => mockOnPriceUpdate({ ...latestPrice, source }));

      expect(store.get(tokenDetailAtom())).toEqual(detail);
    },
  );

  it('ignores prices for another token or network', () => {
    const { store } = renderChart();
    act(() => {
      mockOnPriceUpdate({ ...latestPrice, networkId: 'evm--1' });
      mockOnPriceUpdate({ ...latestPrice, tokenAddress: 'another-token' });
      mockOnPriceUpdate({ ...latestPrice, networkId: undefined });
      mockOnPriceUpdate({ ...latestPrice, tokenAddress: undefined });
    });

    expect(store.get(tokenDetailAtom())).toEqual(detail);
  });

  it('does not let invalid realtime prices prevent the initial snapshot', () => {
    const { store } = renderChart();
    act(() => {
      for (const price of ['', 'invalid', '0', -1, Number.NaN, Infinity]) {
        mockOnPriceUpdate({ ...latestPrice, source: 'realtime', price });
      }
    });
    expect(store.get(tokenDetailAtom())).toEqual(detail);

    act(() => mockOnPriceUpdate(latestPrice));
    expectHeaderPrice('0.002930');
  });
});
