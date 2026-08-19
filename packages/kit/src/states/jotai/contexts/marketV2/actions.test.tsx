/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import type { IMarketTokenDetailResponse } from '@onekeyhq/shared/types/marketV2';

import { useTokenDetailActions } from './actions';
import { ProviderJotaiContextMarketV2, useTokenDetailAtom } from './atoms';
import { fetchMarketTokenDetailWithCache } from './marketTokenDetailInFlightRequest';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./marketTokenDetailInFlightRequest', () => ({
  fetchMarketTokenDetailWithCache: jest.fn(),
}));

const mockFetchMarketTokenDetailWithCache = jest.mocked(
  fetchMarketTokenDetailWithCache,
);

function createWrapper() {
  const store = createStore();

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextMarketV2 store={store}>
        {children}
      </ProviderJotaiContextMarketV2>
    );
  };
}

function createTokenDetailResponse(
  priceConverted: string,
): IMarketTokenDetailResponse {
  return {
    code: 0,
    message: '',
    data: {
      token: {
        address: '0x1234',
        networkId: 'evm--1',
        logoUrl: '',
        name: 'Token',
        symbol: 'TKN',
        decimals: 18,
        priceConverted,
      },
      websocket: {
        txs: true,
        kline: true,
      },
    },
  };
}

describe('useTokenDetailActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not let an older currency request overwrite the current currency', async () => {
    let resolveCny: (response: IMarketTokenDetailResponse) => void = () => {};
    let resolveEur: (response: IMarketTokenDetailResponse) => void = () => {};
    const cnyRequest = new Promise<IMarketTokenDetailResponse>((resolve) => {
      resolveCny = resolve;
    });
    const eurRequest = new Promise<IMarketTokenDetailResponse>((resolve) => {
      resolveEur = resolve;
    });
    mockFetchMarketTokenDetailWithCache.mockImplementation(({ currencyId }) =>
      currencyId === 'cny' ? cnyRequest : eurRequest,
    );

    const { result } = renderHook(
      () => {
        const actions = useTokenDetailActions().current;
        const [tokenDetail] = useTokenDetailAtom();
        return { actions, tokenDetail };
      },
      { wrapper: createWrapper() },
    );

    let cnyFetch: Promise<unknown> | undefined;
    let eurFetch: Promise<unknown> | undefined;
    act(() => {
      cnyFetch = result.current.actions.fetchTokenDetail(
        '0x1234',
        'evm--1',
        'cny',
      );
      eurFetch = result.current.actions.fetchTokenDetail(
        '0x1234',
        'evm--1',
        'eur',
      );
    });

    await act(async () => {
      resolveEur(createTokenDetailResponse('eur-price'));
      await eurFetch;
    });
    expect(result.current.tokenDetail?.priceConverted).toBe('eur-price');

    await act(async () => {
      resolveCny(createTokenDetailResponse('cny-price'));
      await cnyFetch;
    });
    expect(result.current.tokenDetail?.priceConverted).toBe('eur-price');
  });
});
