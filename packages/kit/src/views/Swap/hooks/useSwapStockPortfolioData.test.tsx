import { renderHook, waitFor } from '@testing-library/react-native';

import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
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
  useSelectedAccount: jest.fn(),
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
const mockUseActiveAccount = jest.mocked(useActiveAccount);
const mockUseSelectedAccount = jest.mocked(useSelectedAccount);
const mockUseSelectedDeriveTypeAtom = jest.mocked(useSelectedDeriveTypeAtom);
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
  '0xAAPLbsc': { amount: '0.00000001', totalPrice: '0' },
  AaplSolana: { amount: '0.065', totalPrice: '22.27' },
};

function setStockDetail(
  stockId: string | undefined,
  tokenVariants: IMarketStockTokenVariant[],
) {
  mockUseStockDetail.mockReturnValue({
    stockId,
    tokenVariants,
    portfolioNetworkId: tokenVariants[0]?.networkId,
  } as unknown as ReturnType<typeof useStockDetail>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAccountIdentity.mockReturnValue({
    indexedAccountId: 'indexed-1',
    accountId: undefined,
  });
  mockUseActiveAccount.mockReturnValue({
    activeAccount: {
      ready: true,
      indexedAccount: { id: 'indexed-1' },
      account: undefined,
      deriveType: 'default',
    },
  } as unknown as ReturnType<typeof useActiveAccount>);
  mockUseSelectedAccount.mockReturnValue({
    selectedAccount: {
      indexedAccountId: 'indexed-1',
      networkId: 'evm--1',
      deriveType: 'default',
    },
  } as unknown as ReturnType<typeof useSelectedAccount>);
  mockUseSelectedDeriveTypeAtom.mockReturnValue([
    undefined,
    jest.fn(),
  ] as unknown as ReturnType<typeof useSelectedDeriveTypeAtom>);
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
  it('ignores stale Market derive types and uses Swap global types across networks', async () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: {
        ready: true,
        indexedAccount: { id: 'indexed-1' },
        account: undefined,
        deriveType: 'default',
      },
    } as unknown as ReturnType<typeof useActiveAccount>);
    mockUseSelectedDeriveTypeAtom.mockReturnValue([
      { networkId: 'evm--1', deriveType: 'ledgerLegacy' },
      jest.fn(),
    ] as unknown as ReturnType<typeof useSelectedDeriveTypeAtom>);

    renderHook(() => useSwapStockPortfolioData());

    await waitFor(() => expect(getNetworkAccount).toHaveBeenCalledTimes(3));

    expect(
      getNetworkAccount.mock.calls.find(
        ([params]) => params.networkId === 'evm--1',
      )?.[0],
    ).toEqual(expect.objectContaining({ deriveType: 'default' }));
    expect(
      getNetworkAccount.mock.calls.find(
        ([params]) => params.networkId === 'evm--56',
      )?.[0],
    ).toEqual(expect.objectContaining({ deriveType: 'default' }));
  });

  it('uses the actual same-network account and invalidates rows after an address change', async () => {
    const activeAccount = {
      ready: true,
      indexedAccount: { id: 'indexed-1' },
      network: { id: 'evm--1' },
      deriveType: 'default',
      account: { id: 'default-account', address: 'default-address' },
    };
    mockUseActiveAccount.mockReturnValue({
      activeAccount,
    } as unknown as ReturnType<typeof useActiveAccount>);
    mockUseSelectedDeriveTypeAtom.mockReturnValue([
      { networkId: 'evm--1', deriveType: 'ledgerLegacy' },
      jest.fn(),
    ] as unknown as ReturnType<typeof useSelectedDeriveTypeAtom>);
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() =>
      expect(
        result.current.portfolioData.find(
          (item) => item.tokenId === ethVariant.tokenId,
        )?.accountAddress,
      ).toBe('default-address'),
    );
    expect(
      getNetworkAccount.mock.calls.some(
        ([params]) => params.networkId === 'evm--1',
      ),
    ).toBe(false);
    mockUseActiveAccount.mockReturnValue({
      activeAccount: {
        ...activeAccount,
        deriveType: 'ledgerLegacy',
        account: { id: 'legacy-account', address: 'legacy-address' },
      },
    } as unknown as ReturnType<typeof useActiveAccount>);
    rerender({});
    expect(result.current.portfolioData).toEqual([]);
    await waitFor(() =>
      expect(
        result.current.portfolioData.find(
          (item) => item.tokenId === ethVariant.tokenId,
        )?.accountAddress,
      ).toBe('legacy-address'),
    );
  });

  it('does not reuse cached network accounts after the global derive type changes', async () => {
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));
    getGlobalDeriveTypeOfNetwork.mockResolvedValue('ledgerLegacy');
    setStockDetail('MSFT', [ethVariant, bscVariant, solVariant]);
    rerender({});
    await waitFor(() => expect(getNetworkAccount).toHaveBeenCalledTimes(6));
    expect(getNetworkAccount.mock.calls.slice(3)).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            networkId: 'evm--1',
            deriveType: 'ledgerLegacy',
          }),
        ],
      ]),
    );
  });

  it('lists every positive holding largest first, including dust', async () => {
    const { result } = renderHook(() => useSwapStockPortfolioData());

    await waitFor(() => expect(result.current.portfolioData).toHaveLength(3));

    expect(result.current.positionListData.map((item) => item.tokenId)).toEqual(
      ['aapl-xstocks-solana', 'aapl-ondo-ethereum', 'aapl-ondo-bsc'],
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
    expect(releasePortfolio).toBeUndefined();
    mockUseActiveAccount.mockReturnValue({
      activeAccount: {
        ready: true,
        indexedAccount: { id: 'indexed-2' },
        account: undefined,
        deriveType: 'default',
      },
    } as unknown as ReturnType<typeof useActiveAccount>);
    rerender({});
    await waitFor(() => expect(releasePortfolio).toBeDefined());
    releasePortfolio?.();
    await waitFor(() =>
      expect(result.current.portfolioData[0]?.accountAddress).toBe(
        'address-new-account-evm--1',
      ),
    );
  });

  it.each(['indexed', 'imported'] as const)(
    'waits for the selected %s wallet to synchronize before reading holdings',
    async (kind) => {
      const oldAccount = {
        ready: true,
        indexedAccount: kind === 'indexed' ? { id: 'indexed-1' } : undefined,
        account: { id: 'old-account', address: 'old-address' },
        network: { id: ethVariant.networkId },
        deriveType: 'default',
      };
      setStockDetail('AAPL', [ethVariant]);
      mockUseAccountIdentity.mockReturnValue(
        kind === 'indexed'
          ? { indexedAccountId: 'indexed-1', accountId: undefined }
          : { indexedAccountId: undefined, accountId: 'old-account' },
      );
      mockUseActiveAccount.mockReturnValue({
        activeAccount: oldAccount,
      } as unknown as ReturnType<typeof useActiveAccount>);
      const { result, rerender } = renderHook(() =>
        useSwapStockPortfolioData(),
      );
      await waitFor(() =>
        expect(result.current.portfolioData[0]?.accountAddress).toBe(
          'old-address',
        ),
      );
      fetchMarketAccountPortfolio.mockClear();
      getNetworkAccount.mockClear();
      mockUseAccountIdentity.mockReturnValue(
        kind === 'indexed'
          ? { indexedAccountId: 'indexed-2', accountId: undefined }
          : { indexedAccountId: undefined, accountId: 'new-account' },
      );
      rerender({});
      expect(result.current.portfolioData).toEqual([]);
      expect(result.current.hasAccount).toBe(false);
      expect(fetchMarketAccountPortfolio).not.toHaveBeenCalled();
      expect(getNetworkAccount).not.toHaveBeenCalled();
      mockUseActiveAccount.mockReturnValue({
        activeAccount: {
          ...oldAccount,
          indexedAccount: kind === 'indexed' ? { id: 'indexed-2' } : undefined,
          account: { id: 'new-account', address: 'new-address' },
        },
      } as unknown as ReturnType<typeof useActiveAccount>);
      rerender({});
      await waitFor(() =>
        expect(result.current.portfolioData[0]?.accountAddress).toBe(
          'new-address',
        ),
      );
    },
  );

  it('does not restore old holdings when the same account ID changes address and refresh fails', async () => {
    const activeAccount = {
      ready: true,
      indexedAccount: { id: 'indexed-1' },
      account: { id: 'same-account', address: 'old-address' },
      network: { id: ethVariant.networkId },
      deriveType: 'default',
    };
    setStockDetail('AAPL', [ethVariant]);
    mockUseActiveAccount.mockReturnValue({
      activeAccount,
    } as unknown as ReturnType<typeof useActiveAccount>);
    const { result, rerender } = renderHook(() => useSwapStockPortfolioData());
    await waitFor(() =>
      expect(result.current.portfolioData[0]?.accountAddress).toBe(
        'old-address',
      ),
    );
    fetchMarketAccountPortfolio.mockRejectedValue(
      new OneKeyLocalError('refresh failed'),
    );
    mockUseActiveAccount.mockReturnValue({
      activeAccount: {
        ...activeAccount,
        account: { id: 'same-account', address: 'new-address' },
      },
    } as unknown as ReturnType<typeof useActiveAccount>);
    rerender({});
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(fetchMarketAccountPortfolio).toHaveBeenLastCalledWith(
      expect.objectContaining({ accountAddress: 'new-address' }),
    );
    expect(result.current.portfolioData).toEqual([]);
    expect(result.current.resolvedVariantKeys).toEqual([]);
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
