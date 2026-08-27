import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketAccountPortfolioResponse,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import { fetchStockPortfolioData } from './useStockPortfolioData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: jest.fn(),
}));
jest.mock('./StockDetailContext', () => ({ useStockDetail: jest.fn() }));

function createPortfolioCache() {
  return new Map<string, IMarketAccountPortfolioDisplayItem[]>();
}

function buildVariant(
  overrides: Partial<IMarketStockTokenVariant>,
): IMarketStockTokenVariant {
  return {
    tokenId: 'aapl-ondo-ethereum',
    issuer: 'Ondo',
    symbol: 'AAPLon',
    networkId: 'evm--1',
    contractAddress: '0xAAPL',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
    ...overrides,
  };
}

function buildPortfolioResponse({
  accountAddress,
  tokenAddress,
  symbol,
  amount,
}: {
  accountAddress: string;
  tokenAddress: string;
  symbol: string;
  amount: string;
}): IMarketAccountPortfolioResponse {
  return {
    list: [
      {
        accountAddress,
        tokenAddress,
        symbol,
        amount,
        tokenPrice: '100',
        totalPrice: '100',
      },
    ],
  };
}

describe('fetchStockPortfolioData', () => {
  const ondoVariant = buildVariant({
    logoUrl: 'https://example.com/ondo.png',
    networkLogoUrl: 'https://example.com/ethereum.png',
  });
  const xStocksVariant = buildVariant({
    tokenId: 'aapl-xstocks-solana',
    issuer: 'xStocks',
    symbol: 'AAPLx',
    networkId: 'sol--101',
    contractAddress: 'AaplSolanaAddress',
  });

  it('returns every held issuer and chain variant for the stock', async () => {
    const fetchPortfolio = jest.fn(
      async ({
        networkId,
        accountAddress,
        tokenAddress,
      }: {
        networkId: string;
        accountAddress: string;
        tokenAddress: string;
      }) =>
        buildPortfolioResponse({
          accountAddress,
          tokenAddress,
          symbol: networkId === 'evm--1' ? 'AAPLon' : 'AAPLx',
          amount: networkId === 'evm--1' ? '1' : '2',
        }),
    );

    const result = await fetchStockPortfolioData({
      stockId: 'AAPL',
      tokenVariants: [ondoVariant, xStocksVariant],
      successfulPortfolioCache: createPortfolioCache(),
      resolveNetworkAccount: async (networkId) => ({
        id: `account-${networkId}`,
        address: `address-${networkId}`,
      }),
      fetchPortfolio,
    });

    expect(result).toEqual([
      expect.objectContaining({
        tokenId: 'aapl-ondo-ethereum',
        issuer: 'Ondo',
        networkId: 'evm--1',
        amount: '1',
      }),
      expect.objectContaining({
        tokenId: 'aapl-xstocks-solana',
        issuer: 'xStocks',
        networkId: 'sol--101',
        amount: '2',
      }),
    ]);
    expect(fetchPortfolio).toHaveBeenCalledTimes(2);
  });

  it('keeps identical contract strings on different networks separate', async () => {
    const sharedAddress = '0xSameContract';
    const variants = [
      buildVariant({ contractAddress: sharedAddress, networkId: 'evm--1' }),
      buildVariant({
        tokenId: 'aapl-ondo-base',
        contractAddress: sharedAddress,
        networkId: 'evm--8453',
      }),
    ];

    const result = await fetchStockPortfolioData({
      stockId: 'AAPL',
      tokenVariants: variants,
      successfulPortfolioCache: createPortfolioCache(),
      resolveNetworkAccount: async (networkId) => ({
        id: `account-${networkId}`,
        address: `address-${networkId}`,
      }),
      fetchPortfolio: async ({ networkId, accountAddress, tokenAddress }) =>
        buildPortfolioResponse({
          accountAddress,
          tokenAddress,
          symbol: 'AAPLon',
          amount: networkId === 'evm--1' ? '1' : '3',
        }),
    });

    expect(result.map((item) => [item.networkId, item.amount])).toEqual([
      ['evm--1', '1'],
      ['evm--8453', '3'],
    ]);
  });

  it('retains the last successful row when one variant refresh fails', async () => {
    const successfulPortfolioCache = createPortfolioCache();
    const resolveNetworkAccount = async (networkId: string) => ({
      id: `account-${networkId}`,
      address: `address-${networkId}`,
    });
    const initialFetch = async ({
      networkId,
      accountAddress,
      tokenAddress,
    }: {
      networkId: string;
      accountAddress: string;
      tokenAddress: string;
    }) =>
      buildPortfolioResponse({
        accountAddress,
        tokenAddress,
        symbol: networkId === 'evm--1' ? 'AAPLon' : 'AAPLx',
        amount: networkId === 'evm--1' ? '1' : '2',
      });

    await fetchStockPortfolioData({
      stockId: 'AAPL',
      tokenVariants: [ondoVariant, xStocksVariant],
      successfulPortfolioCache,
      resolveNetworkAccount,
      fetchPortfolio: initialFetch,
    });
    const result = await fetchStockPortfolioData({
      stockId: 'AAPL',
      tokenVariants: [ondoVariant, xStocksVariant],
      successfulPortfolioCache,
      resolveNetworkAccount,
      fetchPortfolio: async (params) => {
        if (params.networkId === 'evm--1') {
          throw new OneKeyLocalError('temporary failure');
        }
        return buildPortfolioResponse({
          ...params,
          symbol: 'AAPLx',
          amount: '4',
        });
      },
    });

    expect(result.map((item) => item.amount)).toEqual(['1', '4']);
  });

  it('does not render zero-balance variants', async () => {
    const result = await fetchStockPortfolioData({
      stockId: 'AAPL',
      tokenVariants: [ondoVariant],
      successfulPortfolioCache: createPortfolioCache(),
      resolveNetworkAccount: async () => ({
        id: 'account-1',
        address: 'address-1',
      }),
      fetchPortfolio: async (params) =>
        buildPortfolioResponse({
          ...params,
          symbol: 'AAPLon',
          amount: '0',
        }),
    });

    expect(result).toEqual([]);
  });
});
