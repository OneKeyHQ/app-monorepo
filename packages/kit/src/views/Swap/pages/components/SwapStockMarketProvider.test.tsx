/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  SwapStockMarketProvider,
  useSwapStockSelection,
} from './SwapStockMarketProvider';

const mockCommitToken = jest.fn();
const mockRiskCheck = jest.fn().mockResolvedValue(false);
const mockFetchSelection = jest.fn<Promise<ISwapToken>, []>();
const mockFetchIdentity = jest.fn<Promise<IMarketStockPublicItem>, []>();
const mockFetchVariantToken = jest.fn<
  Promise<ISwapToken>,
  [IMarketStockTokenVariant]
>();
let mockTokenVariants: IMarketStockTokenVariant[] = [];
let mockVariantsFresh = false;
let mockCurrentToken: ISwapToken;
let mockStockId = 'AAPL';
let mockVariantsPending = false;
let mockCachedParentId: string | undefined;
let mockProviderStockId: string | undefined;
let mockIdentityFetcher: () => Promise<unknown>;
let mockSelection: ReturnType<typeof useSwapStockSelection>;

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (fetcher: typeof mockIdentityFetcher) => {
    mockIdentityFetcher = fetcher;
    return { result: undefined, run: jest.fn() };
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    StockDetailProvider: ({
      children,
      stockId,
    }: PropsWithChildren<{ stockId?: string }>) => {
      mockProviderStockId = stockId;
      return children;
    },
    useStockDetail: () => ({
      stockId: mockStockId,
      tokenVariants: mockTokenVariants,
      isTokenVariantPending: mockVariantsPending,
      isTokenVariantsError: false,
      isTokenVariantsFresh: mockVariantsFresh,
    }),
  }),
);
jest.mock('../../hooks/useSwapTokenRiskCheck', () => ({
  useSwapTokenRiskCheck: () => mockRiskCheck,
}));
jest.mock('../../hooks/useSwapStockChannel', () => ({
  ESwapStockChannelAsyncStatus: { Initializing: 'initializing' },
}));
jest.mock('./SwapStockTradeProvider', () => ({
  useSwapStockTradeContext: () => ({
    currentStockToken: mockCurrentToken,
    selectStockSwapToken: mockCommitToken,
    stockTokenStatus: 'ready',
  }),
}));
jest.mock('../../utils/swapStockMarketData', () => {
  const actual = jest.requireActual<
    typeof import('../../utils/swapStockMarketData')
  >('../../utils/swapStockMarketData');
  return {
    ...actual,
    getCachedSwapStockId: (token: ISwapToken) =>
      token.stock?.stockId ?? mockCachedParentId,
    getCachedSwapStockSelection: () => undefined,
    fetchSwapStockSelection: () => mockFetchSelection(),
    fetchSwapStockTokenIdentity: () => mockFetchIdentity(),
    getCachedSwapStockVariantToken: () => undefined,
    fetchSwapStockVariantToken: (variant: IMarketStockTokenVariant) =>
      mockFetchVariantToken(variant),
  };
});
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);

const targetStock: IMarketStockPublicItem = {
  stockId: 'NVDA',
  symbol: 'NVDA',
  name: 'NVIDIA',
  logoUrl: 'https://example.com/NVDA.png',
  assetType: 'stock',
  price: '200',
  priceChange24hPercent: '1',
  currency: 'USD',
};
const targetToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xnvda',
  symbol: 'NVDAB',
  decimals: 18,
  stock: { stockId: 'NVDA', subtitle: '', sourceLogoUri: '' },
};

function Probe() {
  mockSelection = useSwapStockSelection();
  return null;
}

function Subject() {
  return (
    <SwapStockMarketProvider storeName={'swap' as EJotaiContextStoreNames}>
      <Probe />
    </SwapStockMarketProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentToken = {
    ...targetToken,
    contractAddress: '0xaapl',
    stock: { stockId: 'AAPL', subtitle: '', sourceLogoUri: '' },
  };
  mockStockId = 'AAPL';
  mockVariantsPending = false;
  mockCachedParentId = undefined;
  mockFetchSelection.mockResolvedValue(targetToken);
  mockTokenVariants = [];
  mockVariantsFresh = false;
});

it('retains the target preview through commit and confirms variants independently', async () => {
  let resolveToken: (token: ISwapToken) => void = () => undefined;
  mockFetchSelection.mockReturnValue(
    new Promise((resolve) => {
      resolveToken = resolve;
    }),
  );
  const { rerender } = render(<Subject />);
  let request: Promise<boolean> | undefined;
  act(() => {
    request = mockSelection?.selectStock(targetStock);
  });
  expect(mockSelection?.pendingStock).toEqual(targetStock);
  expect(mockSelection?.stockSelectionPending).toBe(true);

  await act(async () => {
    resolveToken(targetToken);
    await request;
  });
  expect(mockCommitToken).toHaveBeenCalledWith(targetToken, {
    resetReceiveAmount: true,
  });
  // The trade context may commit on a later render than the selection operation.
  expect(mockSelection?.pendingStock).toEqual(targetStock);
  expect(mockSelection?.stockSelectionPending).toBe(true);

  mockCurrentToken = targetToken;
  mockStockId = 'NVDA';
  mockVariantsPending = true;
  rerender(<Subject />);
  expect(mockSelection?.stockSelectionPending).toBe(false);
  expect(mockSelection?.selectedStockPreview).toEqual(targetStock);
  expect(mockSelection?.loadingScopes).toEqual({
    stock: false,
    tradeTarget: true,
    amountInput: true,
  });
  expect(mockSelection?.availability).toBe('pending');
});

it('mounts the cached parent even when the selected child has no own metadata cache', async () => {
  mockCurrentToken = {
    ...targetToken,
    stock: { subtitle: '', sourceLogoUri: '' },
  };
  mockCachedParentId = 'NVDA';
  render(<Subject />);
  expect(mockProviderStockId).toBe('NVDA');
  await expect(mockIdentityFetcher()).resolves.toBeUndefined();
  expect(mockFetchIdentity).not.toHaveBeenCalled();
});

it('moves a restored token to bStocks only once the fetched variant list confirms it', async () => {
  const variant = (issuer: string, contractAddress: string) =>
    ({
      tokenId: `${issuer}-tsla`,
      networkId: 'evm--1',
      contractAddress,
      issuer,
      status: 'active',
      tradingEnabled: true,
      isPaused: false,
    }) as IMarketStockTokenVariant;
  const ondo = variant('ondo', '0xtslaon');
  const bStocks = variant('bstocks', '0xtslab');
  const bStocksToken: ISwapToken = {
    ...targetToken,
    contractAddress: bStocks.contractAddress,
    stock: { stockId: 'TSLA', subtitle: '', sourceLogoUri: '' },
  };
  mockFetchVariantToken.mockResolvedValue(bStocksToken);
  mockCurrentToken = { ...bStocksToken, contractAddress: ondo.contractAddress };
  mockStockId = 'TSLA';
  // The persisted cache still lists an issuer the server may have retired.
  mockTokenVariants = [ondo, bStocks];
  const { rerender } = render(<Subject />);
  expect(mockFetchVariantToken).not.toHaveBeenCalled();
  // The restored token is held instead of being shown and then replaced.
  expect(mockSelection?.loadingScopes.tradeTarget).toBe(true);

  mockVariantsFresh = true;
  await act(async () => {
    rerender(<Subject />);
  });
  expect(mockFetchVariantToken).toHaveBeenCalledWith(bStocks);
  expect(mockCommitToken).toHaveBeenCalledWith(bStocksToken, {
    resetReceiveAmount: true,
  });
});
