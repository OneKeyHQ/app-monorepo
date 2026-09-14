/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getBorrowMarkets = jest.fn();
  (
    globalThis as unknown as {
      __borrowMarketsServiceMock: jest.Mock;
    }
  ).__borrowMarketsServiceMock = getBorrowMarkets;

  return {
    __esModule: true,
    default: { serviceStaking: { getBorrowMarkets } },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const state: {
    current: {
      result: unknown[];
      isLoading: boolean;
      run: jest.Mock;
    };
    method?: () => Promise<unknown[]>;
    firstRunResult?: unknown[];
    firstRunPromise?: Promise<void>;
  } = {
    current: { result: [], isLoading: false, run: jest.fn() },
  };
  (
    globalThis as unknown as {
      __borrowMarketsPromiseResultMock: typeof state;
    }
  ).__borrowMarketsPromiseResultMock = state;

  return {
    usePromiseResult: (method: () => Promise<unknown[]>) => {
      state.method = method;
      React.useEffect(() => {
        state.firstRunPromise = method().then((result) => {
          state.firstRunResult = result;
        });
        // The real hook reruns from its deps effect. This mock intentionally
        // registers at the same hook position to preserve effect ordering.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return state.current;
    },
  };
});

import { act, renderHook } from '@testing-library/react-native';

import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { useBorrowMarkets } from './useBorrowMarkets';

const promiseResultMock = (
  globalThis as unknown as {
    __borrowMarketsPromiseResultMock: {
      current: {
        result: IBorrowMarketItem[];
        isLoading: boolean;
        run: jest.Mock;
      };
      method?: () => Promise<IBorrowMarketItem[]>;
      firstRunResult?: IBorrowMarketItem[];
      firstRunPromise?: Promise<void>;
    };
  }
).__borrowMarketsPromiseResultMock;
const serviceMock = (
  globalThis as unknown as {
    __borrowMarketsServiceMock: jest.Mock;
  }
).__borrowMarketsServiceMock;

describe('useBorrowMarkets SWR hydration', () => {
  beforeEach(() => {
    promiseResultMock.current = {
      result: [],
      isLoading: false,
      run: jest.fn(),
    };
    promiseResultMock.method = undefined;
    promiseResultMock.firstRunResult = undefined;
    promiseResultMock.firstRunPromise = undefined;
    serviceMock.mockReset();
  });

  it('keeps a hydrated snapshot when the hidden Borrow page first runs', async () => {
    const cachedMarkets = [
      {
        provider: 'aave',
        networkId: 'evm--1',
        name: 'Aave',
        logoURI: 'https://example.com/aave.png',
        marketAddress: '0xmarket',
        network: { name: 'Ethereum' },
      },
    ] as IBorrowMarketItem[];
    promiseResultMock.current.result = cachedMarkets;

    const { result } = renderHook(() => useBorrowMarkets({ isActive: false }));

    await act(async () => {
      await promiseResultMock.firstRunPromise;
    });

    expect(promiseResultMock.firstRunResult).toBe(cachedMarkets);
    expect(result.current.markets).toBe(cachedMarkets);
    expect(serviceMock).not.toHaveBeenCalled();
  });
});
