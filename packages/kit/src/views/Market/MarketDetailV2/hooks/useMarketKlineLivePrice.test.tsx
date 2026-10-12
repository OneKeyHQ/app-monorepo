/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextMarketV2,
  tokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { resolveMarketKlineLivePriceEnabled } from '../utils/marketKlineLivePrice';

import { useMarketKlineLivePrice } from './useMarketKlineLivePrice';

const mockFetchAssetKline: jest.MockedFunction<
  (params: unknown) => Promise<IMarketTokenKLineResponse>
> = jest.fn();
const mockFetchTokenKline: jest.MockedFunction<
  (params: unknown) => Promise<IMarketTokenKLineResponse>
> = jest.fn();
let mockRunLivePrice: (() => Promise<void>) | undefined;

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (factory: () => Promise<void>) => {
    mockRunLivePrice = factory;
    return {};
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetKline: (params: unknown) => mockFetchAssetKline(params),
    },
    serviceMarketV2: {
      fetchMarketTokenKline: (params: unknown) => mockFetchTokenKline(params),
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

const props: Parameters<typeof useMarketKlineLivePrice>[0] = {
  enabled: true,
  marketAssetId: 'doge',
  networkId: 'doge--0',
  tokenAddress: '',
};
const detail = {
  address: '',
  networkId: 'doge--0',
  isNative: true,
  name: 'Dogecoin',
  symbol: 'DOGE',
  decimals: 8,
  logoUrl: '',
  price: '0.2',
  detailPriceInitializedAt: 1_788_332_400_000,
};
const response = (price: number): IMarketTokenKLineResponse => ({
  points: [
    {
      t: Math.floor(Date.now() / 1000),
      c: price,
      o: price,
      h: price,
      l: price,
      v: 0,
    },
  ],
  total: 1,
});

function renderLivePrice(
  initialProps: Parameters<typeof useMarketKlineLivePrice>[0] = props,
) {
  const store = createStore();
  store.set(tokenDetailAtom(), detail);
  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextMarketV2 store={store}>
        {children}
      </ProviderJotaiContextMarketV2>
    );
  }
  const hook = renderHook(
    (input: typeof initialProps) => useMarketKlineLivePrice(input),
    { initialProps, wrapper: Wrapper },
  );
  return { ...hook, store };
}

describe('useMarketKlineLivePrice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunLivePrice = undefined;
  });

  it('updates the header from the aggregate asset K-line feed on successive refreshes', async () => {
    const { store } = renderLivePrice();
    mockFetchAssetKline.mockResolvedValueOnce(response(0.3));
    await act(async () => mockRunLivePrice?.());
    expect(mockFetchAssetKline).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '5m',
      currency: 'usd',
      timeFrom: expect.any(Number),
      timeTo: expect.any(Number),
      autoHandleError: false,
    });
    expect(mockFetchTokenKline).not.toHaveBeenCalled();
    expect(store.get(tokenDetailAtom())?.price).toBe('0.3');

    mockFetchAssetKline.mockResolvedValueOnce(response(0.4));
    await act(async () => mockRunLivePrice?.());
    expect(store.get(tokenDetailAtom())?.price).toBe('0.4');
  });

  it('updates the USD token quote and its converted price together', async () => {
    const { store } = renderLivePrice({
      networkId: detail.networkId,
      tokenAddress: detail.address,
      enabled: resolveMarketKlineLivePriceEnabled({
        networkId: detail.networkId,
        tokenAddress: detail.address,
        isNative: detail.isNative,
        priceMode: 'token',
      }),
    });
    store.set(tokenDetailAtom(), { ...detail, priceConverted: '1.4' });

    const refreshLivePrice = async () => mockRunLivePrice?.();
    for (const [price, priceConverted] of [
      [0.3, '2.1'],
      [0.4, '2.8'],
    ] as const) {
      mockFetchTokenKline.mockResolvedValueOnce(response(price));
      await act(refreshLivePrice);
      expect(store.get(tokenDetailAtom())).toMatchObject({
        price: String(price),
        priceConverted,
      });
    }
    expect(mockFetchAssetKline).not.toHaveBeenCalled();
    expect(mockFetchTokenKline).toHaveBeenLastCalledWith({
      networkId: detail.networkId,
      tokenAddress: detail.address,
      interval: '1m',
      timeFrom: expect.any(Number),
      timeTo: expect.any(Number),
      autoHandleError: false,
    });
  });

  const scopeChanges = [
    { scenario: 'disabled', nextProps: { ...props, enabled: false } },
    {
      scenario: 'a different asset',
      nextProps: { ...props, marketAssetId: 'another-asset' },
    },
    {
      scenario: 'the Native token feed',
      nextProps: { ...props, marketAssetId: undefined },
    },
  ];

  it.each(scopeChanges)(
    'drops overlapping asset quotes and late responses for $scenario',
    async ({ nextProps }) => {
      const { store, rerender } = renderLivePrice();
      const older = createDeferred<IMarketTokenKLineResponse>();
      mockFetchAssetKline
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(response(0.4));
      const olderRequest = mockRunLivePrice?.();
      await act(async () => mockRunLivePrice?.());
      await act(async () => {
        older.resolve(response(0.3));
        await olderRequest;
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('0.4');

      const pending = createDeferred<IMarketTokenKLineResponse>();
      mockFetchAssetKline.mockReturnValueOnce(pending.promise);
      const pendingRequest = mockRunLivePrice?.();
      rerender(nextProps);
      await act(async () => {
        pending.resolve(response(0.5));
        await pendingRequest;
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('0.4');
    },
  );

  it.each(scopeChanges)(
    'rejects the previous visit after switching to $scenario and back',
    async ({ nextProps }) => {
      const { store, rerender } = renderLivePrice();
      const previous = createDeferred<IMarketTokenKLineResponse>();
      mockFetchAssetKline.mockReturnValueOnce(previous.promise);
      const previousRequest = mockRunLivePrice?.();
      rerender(nextProps);
      rerender(props);

      const current = createDeferred<IMarketTokenKLineResponse>();
      mockFetchAssetKline.mockReturnValueOnce(current.promise);
      const currentRequest = mockRunLivePrice?.();
      await act(async () => {
        previous.resolve(response(0.1));
        await previousRequest;
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('0.2');
      await act(async () => {
        current.resolve(response(0.4));
        await currentRequest;
      });
      expect(store.get(tokenDetailAtom())?.price).toBe('0.4');
    },
  );
});
