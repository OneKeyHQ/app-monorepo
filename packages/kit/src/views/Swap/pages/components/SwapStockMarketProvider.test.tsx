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
  getTokenIdentityKey,
  settleSwapStockTokenKey,
} from '../../hooks/swapStockChannelUtils';

import {
  SwapStockMarketProvider,
  useSwapStockSelection,
} from './SwapStockMarketProvider';

const mockCommitToken = jest.fn();
const mockPushModal = jest.fn();
const mockRiskCheck = jest.fn().mockResolvedValue(false);
const mockFetchSelection = jest.fn<
  Promise<ISwapToken>,
  [((variants: IMarketStockTokenVariant[]) => void)?]
>();
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
let mockVariantsError = false;
let mockCachedParentId: string | undefined;
let mockProviderStockId: string | undefined;
let mockIdentityFetcher: () => Promise<unknown>;
let mockSelection: ReturnType<typeof useSwapStockSelection>;
let mockDisplayVariants: IMarketStockTokenVariant[] | undefined;
let mockCachedPreview: IMarketStockPublicItem | undefined;

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
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
      isTokenVariantsError: mockVariantsError,
      stockPreview: {
        stockId: mockStockId,
        symbol: mockStockId,
        name: mockStockId,
        logoUrl: '',
      },
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
    getCachedSwapStockAssetPreview: () => mockCachedPreview,
    getCachedSwapStockDisplayVariants: () => mockDisplayVariants,
    fetchSwapStockSelection: (
      _stock: IMarketStockPublicItem,
      _query: string | undefined,
      _locale: string,
      _issuer: string | undefined,
      onVariantsResolved: (variants: IMarketStockTokenVariant[]) => void,
    ) => mockFetchSelection(onVariantsResolved),
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
  mockDisplayVariants = [];
  mockVariantsPending = false;
  mockVariantsError = false;
  mockCachedParentId = undefined;
  mockCachedPreview = undefined;
  mockFetchSelection.mockResolvedValue(targetToken);
  mockRiskCheck.mockReset().mockResolvedValue(false);
  mockTokenVariants = [];
  mockVariantsFresh = false;
});

it.each([false, true])(
  'commits a known holding independently of missing display variants (error: %s)',
  async (failed) => {
    mockDisplayVariants = undefined;
    const previousVariants = mockTokenVariants;
    const view = render(<Subject />);
    await act(async () => {
      expect(await mockSelection?.selectToken(targetToken)).toBe(true);
    });
    expect(mockRiskCheck).toHaveBeenCalledWith(targetToken);
    expect(mockCommitToken).toHaveBeenCalledWith(targetToken, {
      resetReceiveAmount: true,
      manual: true,
    });
    mockCurrentToken = targetToken;
    mockStockId = 'NVDA';
    mockTokenVariants = [];
    mockVariantsPending = !failed;
    mockVariantsError = failed;
    view.rerender(<Subject />);
    expect(mockSelection?.displayStockId).toBe('AAPL');
    expect(mockSelection?.pendingStock?.stockId).toBe('AAPL');
    expect(mockSelection?.displayTokenVariants).toBe(previousVariants);
    expect(mockSelection?.selectionError).toBe(false);
    act(() => mockSelection?.cancelSelection());
    expect(mockSelection?.displayStockId).toBe('AAPL');
    expect(mockSelection?.displayTokenVariants).toBe(previousVariants);

    mockCachedPreview = { ...targetStock, stockId: 'MSFT' };
    let finishRisk: (risk: boolean) => void = () => {};
    mockRiskCheck.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishRisk = resolve;
        }),
    );
    let nextSelection: Promise<boolean> | undefined;
    await act(async () => {
      nextSelection = mockSelection?.selectToken({
        ...targetToken,
        contractAddress: '0xmsft',
        stock: { stockId: 'MSFT', subtitle: '', sourceLogoUri: '' },
      });
    });
    expect(mockSelection?.displayStockId).toBe('AAPL');
    expect(mockSelection?.displayTokenVariants).toBe(previousVariants);
    await act(async () => {
      finishRisk(true);
      await nextSelection;
    });
    expect(mockSelection?.displayStockId).toBe('AAPL');
    expect(mockPushModal).toHaveBeenCalledTimes(1);

    mockVariantsPending = false;
    mockVariantsError = false;
    const targetVariants: IMarketStockTokenVariant[] = [
      {
        tokenId: 'nvda-ethereum',
        issuer: 'bStocks',
        networkId: targetToken.networkId,
        contractAddress: targetToken.contractAddress,
        currency: 'USD',
        status: 'active',
        tradingEnabled: true,
      },
    ];
    mockTokenVariants = targetVariants;
    view.rerender(<Subject />);
    expect(mockSelection?.displayStockId).toBe('NVDA');
    expect(mockSelection?.displayTokenVariants).toBe(targetVariants);
    expect(mockSelection?.stockSelectionPending).toBe(false);
  },
);

it('keeps the committed display until cold variant identity is ready, then switches before the trade token', async () => {
  mockDisplayVariants = undefined;
  let publishVariants: (variants: IMarketStockTokenVariant[]) => void = () =>
    undefined;
  let finishToken: (token: ISwapToken) => void = () => undefined;
  mockFetchSelection.mockImplementationOnce(
    (onVariantsResolved) =>
      new Promise((resolve) => {
        publishVariants = onVariantsResolved ?? (() => undefined);
        finishToken = resolve;
      }),
  );
  render(<Subject />);
  let request: Promise<boolean> | undefined;
  act(() => {
    request = mockSelection?.selectStock(targetStock);
  });
  expect(mockSelection?.stockSelectionPending).toBe(true);
  expect(mockSelection?.displayStockId).toBe('AAPL');
  const variants: IMarketStockTokenVariant[] = [
    {
      tokenId: 'nvda-ethereum',
      issuer: 'bStocks',
      networkId: targetToken.networkId,
      contractAddress: targetToken.contractAddress,
      currency: 'USD',
      status: 'active',
      tradingEnabled: true,
    },
  ];
  act(() => publishVariants(variants));
  expect(mockSelection?.displayStockId).toBe('NVDA');
  expect(mockSelection?.displayTokenVariants).toBe(variants);
  expect(mockSelection?.stockSelectionPending).toBe(true);
  expect(mockCommitToken).not.toHaveBeenCalled();
  await act(async () => {
    finishToken(targetToken);
    await request;
  });
  expect(mockSelection?.displayStockId).toBe('NVDA');
  expect(mockSelection?.displayTokenVariants).toBe(variants);
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
  expect(mockSelection?.displayStockId).toBe('NVDA');

  await act(async () => {
    resolveToken(targetToken);
    await request;
  });
  expect(mockCommitToken).toHaveBeenCalledWith(targetToken, {
    resetReceiveAmount: true,
    manual: true,
  });
  // The trade context may commit on a later render than the selection operation.
  expect(mockSelection?.pendingStock).toEqual(targetStock);
  expect(mockSelection?.stockSelectionPending).toBe(true);
  expect(mockSelection?.displayStockId).toBe('NVDA');

  mockCurrentToken = targetToken;
  mockStockId = 'NVDA';
  mockVariantsPending = true;
  rerender(<Subject />);
  expect(mockSelection?.stockSelectionPending).toBe(false);
  expect(mockSelection?.displayStockId).toBe('NVDA');
  expect(mockSelection?.selectedStockPreview).toEqual(targetStock);
  expect(mockSelection?.loadingScopes).toEqual({
    stock: false,
    tradeTarget: true,
    amountInput: true,
  });
  expect(mockSelection?.availability).toBe('pending');
});

it('uses a known position identity before any company preview is cached', async () => {
  let resolveRisk: (risk: boolean) => void = () => undefined;
  mockRiskCheck.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      resolveRisk = resolve;
    }),
  );
  render(<Subject />);
  let request: Promise<boolean> | undefined;
  act(() => {
    request = mockSelection?.selectToken(targetToken);
  });
  expect(mockSelection?.displayStockId).toBe('NVDA');
  expect(mockSelection?.pendingStock).toBeUndefined();
  await act(async () => {
    resolveRisk(false);
    await request;
  });
  expect(mockSelection?.displayStockId).toBe('NVDA');
});

it('restores the committed display on failure or cancellation and ignores obsolete requests', async () => {
  let finishObsolete: (token: ISwapToken) => void = () => undefined;
  mockFetchSelection.mockReturnValueOnce(
    new Promise<ISwapToken>((resolve) => {
      finishObsolete = resolve;
    }),
  );
  render(<Subject />);
  let obsolete: Promise<boolean> | undefined;
  act(() => {
    obsolete = mockSelection?.selectStock(targetStock);
  });
  expect(mockSelection?.displayStockId).toBe('NVDA');
  act(() => mockSelection?.cancelSelection());
  expect(mockSelection?.displayStockId).toBe('AAPL');

  mockFetchSelection.mockRejectedValueOnce(new Error('Unavailable'));
  await act(async () => {
    await mockSelection?.selectStock({ ...targetStock, stockId: 'GOOGL' });
  });
  expect(mockSelection?.displayStockId).toBe('AAPL');
  expect(mockSelection?.selectionError).toBe(true);
  await act(async () => {
    finishObsolete(targetToken);
    await obsolete;
  });
  expect(mockSelection?.displayStockId).toBe('AAPL');
  expect(mockCommitToken).not.toHaveBeenCalled();
});

it('keeps the newest company visible when an earlier ticker request completes later', async () => {
  let finishFirst: (token: ISwapToken) => void = () => undefined;
  mockFetchSelection.mockReturnValueOnce(
    new Promise<ISwapToken>((resolve) => {
      finishFirst = resolve;
    }),
  );
  render(<Subject />);
  let first: Promise<boolean> | undefined;
  act(() => {
    first = mockSelection?.selectStock(targetStock);
  });
  const googleToken = {
    ...targetToken,
    contractAddress: '0xgoogle',
    stock: { ...targetToken.stock!, stockId: 'GOOGL' },
  };
  mockFetchSelection.mockResolvedValueOnce(googleToken);
  await act(async () => {
    await mockSelection?.selectStock({ ...targetStock, stockId: 'GOOGL' });
  });
  expect(mockSelection?.displayStockId).toBe('GOOGL');
  await act(async () => {
    finishFirst(targetToken);
    await first;
  });
  expect(mockSelection?.displayStockId).toBe('GOOGL');
  expect(mockCommitToken).toHaveBeenCalledTimes(1);
  expect(mockCommitToken).toHaveBeenCalledWith(googleToken, {
    resetReceiveAmount: true,
    manual: true,
  });
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

const variant = (issuer: string, contractAddress: string) =>
  ({
    tokenId: `${issuer}-${contractAddress}`,
    networkId: 'evm--1',
    contractAddress,
    issuer,
    status: 'active',
    tradingEnabled: true,
    isPaused: false,
  }) as IMarketStockTokenVariant;

it('moves a restored token to bStocks only once the fetched variant list confirms it', async () => {
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
  // An automatic variant correction keeps any Recent trades attribution.
  expect(mockCommitToken).toHaveBeenCalledWith(bStocksToken, {
    resetReceiveAmount: true,
    manual: false,
  });
});

it('keeps a non-bStocks token that Market Buy/Sell brought in', async () => {
  const xStocks = variant('xstock', '0xmsftx');
  const bStocks = variant('bstocks', '0xmsftb');
  mockCurrentToken = {
    ...targetToken,
    contractAddress: xStocks.contractAddress,
    stock: { stockId: 'MSFT', subtitle: '', sourceLogoUri: '' },
  };
  mockStockId = 'MSFT';
  mockTokenVariants = [xStocks, bStocks];
  mockVariantsFresh = true;
  // What prepareStockSwapEntry does for the token picked on Market.
  settleSwapStockTokenKey(getTokenIdentityKey(mockCurrentToken));
  await act(async () => {
    render(<Subject />);
  });
  expect(mockFetchVariantToken).not.toHaveBeenCalled();
  expect(mockCommitToken).not.toHaveBeenCalled();
  expect(mockSelection?.loadingScopes.tradeTarget).toBe(false);
});

it('gives up a stalled automatic issuer switch and keeps the current token', async () => {
  jest.useFakeTimers();
  try {
    const ondo = variant('ondo', '0xamznon');
    const bStocks = variant('bstocks', '0xamznb');
    mockFetchVariantToken.mockReturnValue(new Promise(() => undefined));
    mockCurrentToken = {
      ...targetToken,
      contractAddress: ondo.contractAddress,
      stock: { stockId: 'AMZN', subtitle: '', sourceLogoUri: '' },
    };
    mockStockId = 'AMZN';
    mockTokenVariants = [ondo, bStocks];
    mockVariantsFresh = true;
    await act(async () => {
      render(<Subject />);
    });
    expect(mockFetchVariantToken).toHaveBeenCalledWith(bStocks);
    expect(mockSelection?.loadingScopes.tradeTarget).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(mockSelection?.loadingScopes.tradeTarget).toBe(false);
    expect(mockSelection?.selectionError).toBe(false);
    expect(mockCommitToken).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('keeps a manual pick confirmed in the risk prompt when the variant list lands meanwhile', async () => {
  const ondo = variant('ondo', '0xmetaon');
  const bStocks = variant('bstocks', '0xmetab');
  const positionToken: ISwapToken = {
    ...targetToken,
    contractAddress: '0xposition-b',
    stock: { stockId: 'META', subtitle: '', sourceLogoUri: '' },
  };
  mockCurrentToken = {
    ...targetToken,
    contractAddress: ondo.contractAddress,
    stock: { stockId: 'META', subtitle: '', sourceLogoUri: '' },
  };
  mockStockId = 'META';
  mockTokenVariants = [ondo, bStocks];
  mockVariantsFresh = false;
  mockRiskCheck.mockResolvedValueOnce(true);
  const { rerender } = render(<Subject />);

  // The user picks a position that raises the risk prompt.
  await act(async () => {
    await mockSelection?.selectToken(positionToken);
  });
  expect(mockPushModal).toHaveBeenCalledTimes(1);

  // The restored token's variant list lands while the prompt is open.
  mockVariantsFresh = true;
  await act(async () => {
    rerender(<Subject />);
  });
  expect(mockFetchVariantToken).not.toHaveBeenCalled();

  const { onConfirm } = mockPushModal.mock.calls[0][1].params as {
    onConfirm: (close: () => void) => void;
  };
  act(() => onConfirm(() => undefined));
  expect(mockCommitToken).toHaveBeenCalledWith(
    expect.objectContaining({ contractAddress: '0xposition-b' }),
    { resetReceiveAmount: true, manual: true },
  );
});
