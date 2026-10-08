/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { ITradingViewNativePriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import {
  ProviderJotaiContextMarketV2,
  isNativeAtom,
  tokenDetailAtom,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { useMarketNativeChartPriceUpdate } from './useMarketNativeChartPriceUpdate';

const mockFetchMarketTokenDetailByTokenAddress: jest.MockedFunction<
  (tokenAddress: string, networkId: string) => Promise<unknown>
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenDetailByTokenAddress: (
        ...args: Parameters<typeof mockFetchMarketTokenDetailByTokenAddress>
      ) => mockFetchMarketTokenDetailByTokenAddress(...args),
    },
  },
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

const tokenDetail: IMarketTokenDetail = {
  address: '0xabc',
  networkId: 'evm--1',
  name: 'Test token',
  symbol: 'TEST',
  decimals: 18,
  logoUrl: '',
  price: '1',
};
const receivedAt = 1_788_332_400_000;
const realtimeUpdate: ITradingViewNativePriceUpdateData = {
  price: 2,
  receivedAt,
  source: 'realtime',
  timestamp: 1_788_328_800,
};
const defaultProps = { networkId: 'evm--1', tokenAddress: '0xabc' };

// `detail: null` mounts the chart before any token detail is in the store.
function renderNativePriceHook({
  initialProps = defaultProps,
  detail = tokenDetail,
}: {
  initialProps?: Parameters<typeof useMarketNativeChartPriceUpdate>[0];
  detail?: IMarketTokenDetail | null;
} = {}) {
  const store = createStore();
  if (detail) {
    store.set(tokenDetailAtom(), detail);
  }
  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextMarketV2 store={store}>
        {children}
      </ProviderJotaiContextMarketV2>
    );
  }
  const hook = renderHook(
    (props: typeof initialProps) => ({
      onPriceUpdate: useMarketNativeChartPriceUpdate(props),
      actions: useTokenDetailActions().current,
    }),
    { initialProps, wrapper: Wrapper },
  );
  return { ...hook, store };
}

describe('useMarketNativeChartPriceUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(receivedAt);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['history', 'realtime'] as const)(
    'keeps the latest %s price when the detail request returns an older price',
    async (source) => {
      const { result, store } = renderNativePriceHook();

      act(() => result.current.onPriceUpdate({ ...realtimeUpdate, source }));
      expect(store.get(tokenDetailAtom())).toMatchObject({
        price: '2',
        lastUpdated: receivedAt,
        chartPriceUpdatedAt: receivedAt,
      });

      mockFetchMarketTokenDetailByTokenAddress.mockResolvedValueOnce({
        data: { token: { ...tokenDetail, price: '1.5', volume24h: '100' } },
      });
      await act(async () => {
        await result.current.actions.fetchTokenDetail('0xabc', 'evm--1');
      });
      expect(store.get(tokenDetailAtom())).toMatchObject({
        price: '2',
        volume24h: '100',
        lastUpdated: receivedAt,
      });
    },
  );

  it.each([
    { networkId: 'sui--mainnet', address: '0x2::sui::SUI' },
    {
      networkId: 'evm--1',
      address: '0x0000000000000000000000000000000000000000',
    },
  ])(
    'applies chart prices to a native coin whose detail carries address $address',
    ({ networkId, address }) => {
      const { result, store } = renderNativePriceHook({
        initialProps: { networkId, tokenAddress: '' },
        detail: { ...tokenDetail, networkId, address, isNative: true },
      });
      store.set(isNativeAtom(), true);

      act(() =>
        result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' }),
      );
      expect(store.get(tokenDetailAtom())?.price).toBe('2');

      act(() => result.current.onPriceUpdate({ ...realtimeUpdate, price: 3 }));
      expect(store.get(tokenDetailAtom())?.price).toBe('3');
    },
  );

  it('ignores invalid prices without blocking the initial history price', () => {
    const { result, store } = renderNativePriceHook();

    act(() => {
      for (const source of ['history', 'realtime'] as const) {
        for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
          result.current.onPriceUpdate({ ...realtimeUpdate, source, price });
        }
      }
    });
    expect(store.get(tokenDetailAtom())).toEqual(tokenDetail);

    act(() =>
      result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' }),
    );
    expect(store.get(tokenDetailAtom())?.price).toBe('2');
  });

  it.each([
    { delayMs: 6000, source: 'history' as const },
    { delayMs: 11_000, source: 'history' as const },
    { delayMs: 60_000, source: 'realtime' as const },
  ])(
    'preserves $source when the initial response arrives $delayMs ms later',
    async ({ delayMs, source }) => {
      const { result, store } = renderNativePriceHook();
      const response = createDeferred<unknown>();
      mockFetchMarketTokenDetailByTokenAddress.mockReturnValueOnce(
        response.promise,
      );
      let request: Promise<unknown> | undefined;
      act(() => {
        request = result.current.actions.fetchTokenDetail('0xabc', 'evm--1');
        result.current.onPriceUpdate({ ...realtimeUpdate, source });
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('2');

      jest.spyOn(Date, 'now').mockReturnValue(receivedAt + delayMs);
      await act(async () => {
        response.resolve({
          data: {
            token: {
              ...tokenDetail,
              price: '1.5',
              volume24h: '100',
              lastUpdated: receivedAt + delayMs,
            },
          },
        });
        await request;
      });
      expect(store.get(tokenDetailAtom())).toMatchObject({
        price: '2',
        lastUpdated: receivedAt,
        chartPriceUpdatedAt: receivedAt,
        volume24h: '100',
      });
    },
  );

  it.each([true, false])(
    'accepts history once before realtime when details are ready: %s',
    (detailsReady) => {
      const { result, store } = renderNativePriceHook({
        detail: detailsReady ? tokenDetail : null,
      });

      act(() => {
        result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' });
        result.current.onPriceUpdate({
          ...realtimeUpdate,
          source: 'history',
          price: 1.5,
        });
      });
      if (!detailsReady) {
        expect(store.get(tokenDetailAtom())).toBeUndefined();
        act(() => store.set(tokenDetailAtom(), tokenDetail));
      }
      expect(store.get(tokenDetailAtom())).toMatchObject({
        price: '2',
        lastUpdated: receivedAt,
      });

      act(() => {
        result.current.onPriceUpdate({ ...realtimeUpdate, price: 3 });
        result.current.onPriceUpdate({
          ...realtimeUpdate,
          source: 'history',
          price: 1.5,
        });
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('3');
    },
  );

  it.each([true, false])(
    'does not replace realtime with late history when details are ready: %s',
    (detailsReady) => {
      const { result, store } = renderNativePriceHook({
        detail: detailsReady ? tokenDetail : null,
      });

      act(() => {
        result.current.onPriceUpdate(realtimeUpdate);
        result.current.onPriceUpdate({ ...realtimeUpdate, price: 3 });
        result.current.onPriceUpdate({
          ...realtimeUpdate,
          source: 'history',
          price: 1.5,
        });
      });
      if (!detailsReady) {
        act(() => store.set(tokenDetailAtom(), tokenDetail));
      }
      expect(store.get(tokenDetailAtom())?.price).toBe('3');
    },
  );

  it('stamps strictly increasing timestamps for ticks in the same millisecond', () => {
    const { result, store } = renderNativePriceHook({
      detail: { ...tokenDetail, lastUpdated: receivedAt },
    });

    act(() =>
      result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' }),
    );
    expect(store.get(tokenDetailAtom())).toMatchObject({
      price: '2',
      lastUpdated: receivedAt + 1,
    });

    act(() => result.current.onPriceUpdate({ ...realtimeUpdate, price: 3 }));
    expect(store.get(tokenDetailAtom())).toMatchObject({
      price: '3',
      lastUpdated: receivedAt + 2,
    });
  });

  it.each([
    { networkId: 'evm--1', enabled: false },
    { networkId: '', enabled: true },
  ])(
    'ignores updates when the token price source is inactive: %j',
    (params) => {
      const { result, store } = renderNativePriceHook({
        initialProps: { ...params, tokenAddress: tokenDetail.address },
      });

      act(() => {
        result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' });
        result.current.onPriceUpdate(realtimeUpdate);
      });
      expect(store.get(tokenDetailAtom())).toEqual(tokenDetail);
    },
  );

  it.each([
    { networkId: 'evm--1', tokenAddress: '0xdef' },
    { networkId: 'evm--8453', tokenAddress: '0xabc' },
  ])(
    'discards a late update after switching token identity: %j',
    (nextToken) => {
      const { result, rerender, store } = renderNativePriceHook();
      const previousOnPriceUpdate = result.current.onPriceUpdate;
      const nextDetail = {
        ...tokenDetail,
        networkId: nextToken.networkId,
        address: nextToken.tokenAddress,
        price: '3',
      };

      act(() => store.set(tokenDetailAtom(), nextDetail));
      rerender(nextToken);
      act(() => previousOnPriceUpdate(realtimeUpdate));
      expect(store.get(tokenDetailAtom())).toEqual(nextDetail);

      act(() =>
        result.current.onPriceUpdate({
          ...realtimeUpdate,
          source: 'history',
          price: 4,
        }),
      );
      expect(store.get(tokenDetailAtom())?.price).toBe('4');
    },
  );

  it('discards buffered prices and stale callbacks when disabled or unmounted', () => {
    const props = { ...defaultProps, enabled: true };
    const { result, rerender, unmount, store } = renderNativePriceHook({
      initialProps: props,
      detail: null,
    });
    const previousOnPriceUpdate = result.current.onPriceUpdate;
    act(() => previousOnPriceUpdate({ ...realtimeUpdate, source: 'history' }));
    rerender({ ...props, enabled: false });
    act(() => {
      store.set(tokenDetailAtom(), tokenDetail);
      previousOnPriceUpdate(realtimeUpdate);
    });
    expect(store.get(tokenDetailAtom())).toEqual(tokenDetail);

    rerender(props);
    expect(store.get(tokenDetailAtom())).toEqual(tokenDetail);
    act(() =>
      result.current.onPriceUpdate({ ...realtimeUpdate, source: 'history' }),
    );
    expect(store.get(tokenDetailAtom())?.price).toBe('2');

    const { onPriceUpdate } = result.current;
    act(() => store.set(tokenDetailAtom(), undefined));
    act(() => onPriceUpdate({ ...realtimeUpdate, price: 3 }));
    unmount();
    act(() => {
      store.set(tokenDetailAtom(), tokenDetail);
      onPriceUpdate(realtimeUpdate);
    });
    expect(store.get(tokenDetailAtom())).toEqual(tokenDetail);
  });
});
