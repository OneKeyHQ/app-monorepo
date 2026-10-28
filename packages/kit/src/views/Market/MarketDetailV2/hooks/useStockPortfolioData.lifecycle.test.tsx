/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IMarketAccountPortfolioResponse,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { useStockPortfolioData } from './useStockPortfolioData';

type IFetchParams = {
  networkId: string;
  accountAddress: string;
  tokenAddress: string;
};

const variant: IMarketStockTokenVariant = {
  tokenId: 'aapl-ondo-ethereum',
  issuer: 'Ondo',
  symbol: 'AAPLon',
  networkId: 'evm--1',
  contractAddress: '0xAAPL',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};
const secondVariant = {
  ...variant,
  tokenId: 'aapl-ondo-base',
  networkId: 'evm--8453',
};

let mockAccount: {
  ready: boolean;
  account?: { id: string };
  indexedAccount?: { id: string };
  deriveType: IAccountDeriveTypes;
};
let mockStock: {
  stockId: string;
  portfolioNetworkId: string;
  tokenVariants: IMarketStockTokenVariant[];
  isTokenVariantPending: boolean;
  isTokenVariantsError: boolean;
};
let mockSelectedDeriveType:
  | { networkId: string; deriveType: IAccountDeriveTypes }
  | undefined;
const mockFetchPortfolio = jest.fn<
  Promise<IMarketAccountPortfolioResponse>,
  [IFetchParams]
>();
const mockRetryTokenVariants = jest.fn(async () => {});
const mockGetNetworkAccount = jest.fn(
  async ({
    accountId,
    indexedAccountId,
    networkId,
  }: {
    accountId?: string;
    indexedAccountId?: string;
    networkId: string;
  }) => ({
    id: `${indexedAccountId ?? accountId}:${networkId}`,
    address: `${indexedAccountId ?? accountId}:${networkId}`,
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: { getGlobalDeriveTypeOfNetwork: async () => 'default' },
    serviceAccount: {
      getNetworkAccount: (
        params: Parameters<typeof mockGetNetworkAccount>[0],
      ) => mockGetNetworkAccount(params),
    },
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: IFetchParams) =>
        mockFetchPortfolio(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockAccount }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [mockSelectedDeriveType],
}));
jest.mock('./StockDetailContext', () => ({
  useStockDetail: () => ({
    ...mockStock,
    retryTokenVariants: mockRetryTokenVariants,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise,
  };
});

function portfolioResponse(
  params: IFetchParams,
  amount = '1',
): IMarketAccountPortfolioResponse {
  return {
    list: [
      {
        accountAddress: params.accountAddress,
        tokenAddress: params.tokenAddress,
        amount,
        symbol: 'AAPLon',
        tokenPrice: '100',
        totalPrice: '100',
      },
    ],
  };
}

function deferredPortfolio() {
  let resolve!: (value: IMarketAccountPortfolioResponse) => void;
  const promise = new Promise<IMarketAccountPortfolioResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(0);
    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('stock portfolio loading and scope changes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAccount = {
      ready: true,
      account: { id: 'account-a' },
      deriveType: 'default',
    };
    mockStock = {
      stockId: 'AAPL',
      portfolioNetworkId: variant.networkId,
      tokenVariants: [variant],
      isTokenVariantPending: false,
      isTokenVariantsError: false,
    };
    mockSelectedDeriveType = undefined;
    mockRetryTokenVariants.mockReset();
    mockGetNetworkAccount.mockClear();
    mockFetchPortfolio.mockReset();
    mockFetchPortfolio.mockImplementation(async (params) =>
      portfolioResponse(params),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for the first portfolio of the loaded variants instead of treating the pre-variant result as zero', async () => {
    mockStock.tokenVariants = [];
    mockStock.isTokenVariantPending = true;
    const pending = deferredPortfolio();
    mockFetchPortfolio.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    await flush();
    expect(result.current.isPortfolioPending).toBe(true);

    mockStock = {
      ...mockStock,
      tokenVariants: [variant],
      isTokenVariantPending: false,
    };
    rerender();
    await flush();
    expect(result.current.isPortfolioPending).toBe(true);
    expect(result.current.portfolioData).toEqual([]);

    pending.resolve(portfolioResponse(mockFetchPortfolio.mock.calls[0][0]));
    await flush();
    expect(result.current.isPortfolioPending).toBe(false);
    expect(result.current.portfolioData).toHaveLength(1);
  });

  it('starts the account lookup immediately when the account becomes ready', async () => {
    mockAccount.ready = false;
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    await flush();
    expect(result.current.isPortfolioPending).toBe(true);
    mockAccount.ready = true;
    rerender();
    await flush();
    expect(result.current.portfolioData).toHaveLength(1);
    expect(result.current.isPortfolioPending).toBe(false);
  });

  it.each(['account', 'indexed account', 'stock', 'derivation', 'variants'])(
    'immediately hides previous rows and resolution keys when the %s changes',
    async (scope) => {
      const { result, rerender } = renderHook(() => useStockPortfolioData());
      await flush();
      expect(result.current.portfolioData).toHaveLength(1);
      const pending = deferredPortfolio();
      mockFetchPortfolio.mockReturnValue(pending.promise);
      if (scope === 'account') mockAccount.account = { id: 'account-b' };
      if (scope === 'indexed account') {
        mockAccount.indexedAccount = { id: 'indexed-b' };
      }
      if (scope === 'stock') mockStock.stockId = 'NVDA';
      if (scope === 'derivation') {
        mockSelectedDeriveType = {
          networkId: variant.networkId,
          deriveType: 'ledgerLive',
        };
      }
      if (scope === 'variants') mockStock.tokenVariants = [secondVariant];
      rerender();
      expect(result.current.portfolioData).toEqual([]);
      expect(result.current.resolvedVariantKeys).toEqual([]);
      expect(result.current.isPortfolioPending).toBe(true);
      await flush();

      pending.resolve(
        portfolioResponse(mockFetchPortfolio.mock.calls[1][0], '2'),
      );
      await flush();
      expect(result.current.portfolioData[0].amount).toBe('2');
      expect(result.current.isPortfolioPending).toBe(false);
    },
  );

  it('does not replace the new account result when the old request finishes late', async () => {
    const oldRequest = deferredPortfolio();
    mockFetchPortfolio.mockReturnValueOnce(oldRequest.promise);
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    await flush();
    const oldParams = mockFetchPortfolio.mock.calls[0][0];
    mockAccount.account = { id: 'account-b' };
    rerender();
    await flush();
    expect(result.current.portfolioData[0].accountAddress).toBe(
      'account-b:evm--1',
    );
    oldRequest.resolve(portfolioResponse(oldParams, '9'));
    await flush();
    expect(result.current.portfolioData[0].accountAddress).toBe(
      'account-b:evm--1',
    );
    expect(result.current.portfolioData[0].amount).toBe('1');
  });

  it.each(['account lookup', 'portfolio request'])(
    'marks a partial %s failure as incomplete and recovers on retry',
    async (failure) => {
      mockStock.tokenVariants = [variant, secondVariant];
      if (failure === 'account lookup') {
        mockGetNetworkAccount.mockRejectedValueOnce(new Error('offline'));
      } else {
        mockFetchPortfolio.mockRejectedValueOnce(new Error('offline'));
      }
      const { result } = renderHook(() => useStockPortfolioData());
      await flush();
      expect(result.current.portfolioData).toHaveLength(1);
      expect(result.current.isPortfolioPending).toBe(false);
      expect(result.current.isPortfolioIncomplete).toBe(true);

      await act(async () => {
        await result.current.fetchPortfolio();
      });
      expect(result.current.portfolioData).toHaveLength(2);
      expect(result.current.isPortfolioIncomplete).toBe(false);
    },
  );

  it('distinguishes a fully resolved zero holding from an unavailable portfolio', async () => {
    mockFetchPortfolio.mockImplementation(async (params) =>
      portfolioResponse(params, '0'),
    );
    const { result } = renderHook(() => useStockPortfolioData());
    await flush();
    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.isPortfolioPending).toBe(false);
    expect(result.current.isPortfolioIncomplete).toBe(false);
  });

  it('does not present a failed variant list as a resolved zero holding', async () => {
    mockStock.tokenVariants = [];
    mockStock.isTokenVariantsError = true;
    const { result, rerender } = renderHook(() => useStockPortfolioData());
    await flush();
    expect(result.current.isPortfolioPending).toBe(false);
    expect(result.current.isPortfolioIncomplete).toBe(true);

    mockRetryTokenVariants.mockImplementationOnce(async () => {
      mockStock.isTokenVariantsError = false;
      mockStock.tokenVariants = [variant];
    });
    await act(async () => {
      await result.current.fetchPortfolio();
    });
    rerender();
    await flush();
    expect(result.current.portfolioData).toHaveLength(1);
    expect(result.current.isPortfolioIncomplete).toBe(false);
  });

  it.each(['not ready', 'disconnected', 'disabled'])(
    'hides the previous holdings when the account is %s',
    async (state) => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useStockPortfolioData({ enabled }),
        { initialProps: { enabled: true } },
      );
      await flush();
      expect(result.current.portfolioData).toHaveLength(1);
      if (state === 'not ready') mockAccount.ready = false;
      if (state === 'disconnected') mockAccount.account = undefined;
      rerender({ enabled: state !== 'disabled' });
      expect(result.current.portfolioData).toEqual([]);
      expect(result.current.resolvedVariantKeys).toEqual([]);
    },
  );
});
