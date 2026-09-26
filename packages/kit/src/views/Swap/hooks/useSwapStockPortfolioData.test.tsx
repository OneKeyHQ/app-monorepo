import { renderHook, waitFor } from '@testing-library/react-native';

import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IMarketAccountPortfolioResponse,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { useSwapProPositionAccountIdentity } from './useSwapPro';
import { useSwapStockPortfolioData } from './useSwapStockPortfolioData';

const mockGetNetworkAccount = jest.fn<
  Promise<INetworkAccount>,
  [{ networkId: string }]
>();
const mockFetchMarketAccountPortfolio = jest.fn<
  Promise<IMarketAccountPortfolioResponse>,
  [{ accountAddress: string; tokenAddress: string }]
>();
const mockGetGlobalDeriveTypeOfNetwork = jest.fn<Promise<string>, [unknown]>();

// Arrow wrappers: the hoisted factory must not touch the `mock*` bindings
// before their declarations run.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getNetworkAccount: (params: { networkId: string }) =>
        mockGetNetworkAccount(params),
    },
    serviceMarketV2: {
      fetchMarketAccountPortfolio: (params: {
        accountAddress: string;
        tokenAddress: string;
      }) => mockFetchMarketAccountPortfolio(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: unknown) =>
        mockGetGlobalDeriveTypeOfNetwork(params),
    },
  },
}));
// A minimal stand-in with the one property the hook relies on: the previous
// result stays in place until the next request settles.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { act } = jest.requireActual<
    typeof import('@testing-library/react-native')
  >('@testing-library/react-native');
  return {
    usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
      const [state, setState] = React.useState<{
        result: unknown;
        isLoading: boolean;
      }>({ result: undefined, isLoading: false });
      /* eslint-disable react-hooks/exhaustive-deps -- forwards the caller's list */
      React.useEffect(() => {
        let cancelled = false;
        setState((prev) => ({ ...prev, isLoading: true }));
        void method().then((result) => {
          if (!cancelled) act(() => setState({ result, isLoading: false }));
        });
        return () => {
          cancelled = true;
        };
      }, deps);
      /* eslint-enable react-hooks/exhaustive-deps */
      return { ...state, run: jest.fn() };
    },
  };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: jest.fn(),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({ useStockDetail: jest.fn() }),
);
jest.mock('./useSwapPro', () => ({
  useSwapProPositionAccountIdentity: jest.fn(),
}));

const getNetworkAccount = mockGetNetworkAccount;
const fetchMarketAccountPortfolio = mockFetchMarketAccountPortfolio;
const getGlobalDeriveTypeOfNetwork = mockGetGlobalDeriveTypeOfNetwork;
const mockUseStockDetail = jest.mocked(useStockDetail);
const mockUseAccountIdentity = jest.mocked(useSwapProPositionAccountIdentity);

function buildVariant(
  overrides: Partial<IMarketStockTokenVariant>,
): IMarketStockTokenVariant {
  return {
    tokenId: 'aapl-ondo-ethereum',
    issuer: 'ondo',
    symbol: 'AAPLon',
    networkId: 'evm--1',
    contractAddress: '0xAAPL',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
    ...overrides,
  };
}

const ethVariant = buildVariant({});
const bscVariant = buildVariant({
  tokenId: 'aapl-ondo-bsc',
  networkId: 'evm--56',
  contractAddress: '0xAAPLbsc',
});
const solVariant = buildVariant({
  tokenId: 'aapl-xstocks-solana',
  issuer: 'xstocks',
  symbol: 'AAPLx',
  networkId: 'sol--101',
  contractAddress: 'AaplSolana',
});

// Value per contract so each test can shape the table it expects.
const holdings: Record<string, { amount: string; totalPrice: string }> = {
  '0xAAPL': { amount: '0.06', totalPrice: '21.19' },
  '0xAAPLbsc': { amount: '0.00001', totalPrice: '0.003' },
  AaplSolana: { amount: '0.065', totalPrice: '22.27' },
};

function setStockDetail(
  stockId: string | undefined,
  tokenVariants: IMarketStockTokenVariant[],
) {
  mockUseStockDetail.mockReturnValue({
    stockId,
    tokenVariants,
  } as unknown as ReturnType<typeof useStockDetail>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAccountIdentity.mockReturnValue({
    indexedAccountId: 'indexed-1',
    accountId: undefined,
  });
  getGlobalDeriveTypeOfNetwork.mockResolvedValue('default');
  getNetworkAccount.mockImplementation(
    async ({ networkId }) =>
      ({
        id: `account-${networkId}`,
        address: `address-${networkId}`,
      }) as unknown as INetworkAccount,
  );
  fetchMarketAccountPortfolio.mockImplementation(
    async ({ accountAddress, tokenAddress }) =>
      ({
        list: [
          {
            accountAddress,
            tokenAddress,
            symbol: 'AAPL',
            tokenPrice: '340',
            ...holdings[tokenAddress],
          },
        ],
      }) as IMarketAccountPortfolioResponse,
  );
  setStockDetail('AAPL', [ethVariant, bscVariant, solVariant]);
});

describe('useSwapStockPortfolioData', () => {
  it('lists the holdings largest first and keeps dust out of the table only', async () => {
    const { result } = renderHook(() => useSwapStockPortfolioData());

    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));

    expect(result.current.positionListData.map((item) => item.tokenId)).toEqual(
      ['aapl-xstocks-solana', 'aapl-ondo-ethereum'],
    );
    // The selector still needs the dust holding to report a real balance.
    expect(result.current.portfolioData.map((item) => item.tokenId)).toContain(
      'aapl-ondo-bsc',
    );
    expect(result.current.resolvedVariantKeys).toHaveLength(3);
  });

  it('reuses account lookups across variant refreshes and stock switches', async () => {
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));
    expect(getNetworkAccount).toHaveBeenCalledTimes(3);
    expect(fetchMarketAccountPortfolio).toHaveBeenCalledTimes(3);

    // The 6s metadata poll hands back a new array with the same identities:
    // nothing should be requested again.
    setStockDetail('AAPL', [
      { ...ethVariant },
      { ...bscVariant },
      { ...solVariant },
    ]);
    rerender({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMarketAccountPortfolio).toHaveBeenCalledTimes(3);

    // A new stock on the same networks pays only for the portfolio requests.
    setStockDetail('NVDA', [
      buildVariant({
        tokenId: 'nvda-ondo-ethereum',
        symbol: 'NVDAon',
        contractAddress: '0xNVDA',
      }),
    ]);
    holdings['0xNVDA'] = { amount: '0.09', totalPrice: '21.97' };
    rerender({});
    await waitFor(() =>
      expect(result.current.portfolioData.map((item) => item.tokenId)).toEqual([
        'nvda-ondo-ethereum',
      ]),
    );
    expect(getNetworkAccount).toHaveBeenCalledTimes(3);
    expect(fetchMarketAccountPortfolio).toHaveBeenCalledTimes(4);
  });

  it('does not show the previous stock while the next one loads', async () => {
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));

    let releasePortfolio: (() => void) | undefined;
    fetchMarketAccountPortfolio.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePortfolio = () =>
            resolve({
              list: [
                {
                  accountAddress: 'address-evm--1',
                  tokenAddress: '0xNVDA',
                  symbol: 'NVDAon',
                  tokenPrice: '226',
                  amount: '0.09',
                  totalPrice: '21.97',
                },
              ],
            });
        }),
    );
    setStockDetail('NVDA', [
      buildVariant({
        tokenId: 'nvda-ondo-ethereum',
        symbol: 'NVDAon',
        contractAddress: '0xNVDA',
      }),
    ]);
    rerender({});

    // Apple's rows are gone at once; Nvidia's arrive when the request lands.
    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.resolvedVariantKeys).toEqual([]);
    await waitFor(() => expect(releasePortfolio).toBeDefined());
    releasePortfolio?.();
    await waitFor(() =>
      expect(result.current.portfolioData.map((item) => item.tokenId)).toEqual([
        'nvda-ondo-ethereum',
      ]),
    );
  });

  it('does not show the previous account while the same stock loads', async () => {
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));

    let releasePortfolio: (() => void) | undefined;
    fetchMarketAccountPortfolio.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePortfolio = () =>
            resolve({
              list: [
                {
                  accountAddress: 'address-new-account-evm--1',
                  tokenAddress: '0xAAPL',
                  symbol: 'AAPL',
                  tokenPrice: '340',
                  amount: '0.2',
                  totalPrice: '68',
                },
              ],
            });
        }),
    );
    mockUseAccountIdentity.mockReturnValue({
      indexedAccountId: 'indexed-2',
      accountId: undefined,
    });
    rerender({});

    expect(result.current.portfolioData).toEqual([]);
    await waitFor(() => expect(releasePortfolio).toBeDefined());
    releasePortfolio?.();
    await waitFor(() =>
      expect(result.current.portfolioData[0]?.accountAddress).toBe(
        'address-new-account-evm--1',
      ),
    );
  });

  it('retries an account lookup that failed instead of pinning the failure', async () => {
    getNetworkAccount.mockImplementation(async ({ networkId }) => {
      if (networkId === 'sol--101' && getNetworkAccount.mock.calls.length < 4) {
        throw new OneKeyLocalError('no solana address yet');
      }
      return {
        id: `account-${networkId}`,
        address: `address-${networkId}`,
      } as unknown as INetworkAccount;
    });
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() => expect(result.current.portfolioData).toHaveLength(2));
    // Solana was never read, so it is not reported as a resolved zero.
    expect(result.current.resolvedVariantKeys).toHaveLength(2);

    setStockDetail('NVDA', [
      buildVariant({
        tokenId: 'nvda-xstocks-solana',
        symbol: 'NVDAx',
        networkId: 'sol--101',
        contractAddress: 'NvdaSolana',
      }),
    ]);
    holdings.NvdaSolana = { amount: '1', totalPrice: '262' };
    rerender({});
    await waitFor(() =>
      expect(result.current.portfolioData.map((item) => item.tokenId)).toEqual([
        'nvda-xstocks-solana',
      ]),
    );
    expect(
      getNetworkAccount.mock.calls.filter(
        ([params]) => params.networkId === 'sol--101',
      ),
    ).toHaveLength(2);
  });

  it('reports nothing without an account or a stock', async () => {
    mockUseAccountIdentity.mockReturnValue({
      indexedAccountId: undefined,
      accountId: undefined,
    });
    const { result } = renderHook(() => useSwapStockPortfolioData());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.hasAccount).toBe(false);
    expect(result.current.portfolioData).toEqual([]);
    expect(fetchMarketAccountPortfolio).not.toHaveBeenCalled();
  });
});
