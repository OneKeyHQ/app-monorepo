import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockTradeSide,
  buildStockSwapTokenFromMarketListToken,
  filterStockPayTokenCandidates,
  findTokenFromCandidates,
  getTokenIdentityKey,
  getValidStockExecutionBalance,
  isStockCanonicalInputOwnerReady,
  isStockExecutionBalancePublished,
  isStockExecutionBalanceScopeReady,
  isStockExecutionPairSynced,
  isStockPayTokenReadyForTradeInput,
  isStockTradeReadyForQuote,
  resolveStockChannelBootstrapSelection,
  resolveStockChannelOwnedPayToken,
  resolveStockChannelPayTokenStatus,
  resolveStockChannelSwapPair,
  resolveStockDisplayBalance,
  resolveStockKLineToken,
  shouldLoadDefaultStockToken,
  shouldRenderStockTradeInputSkeleton,
  shouldResetStockTradeReceiveAmount,
} from './swapStockChannelUtils';

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

const usdcPayToken = {
  ...usdcToken,
  speedSwapDefaultAmount: [],
};

const usdtPayToken = {
  ...usdtToken,
  speedSwapDefaultAmount: [],
};

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

const micronStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xmu',
  symbol: 'MU',
  decimals: 18,
  isStock: true,
};

describe('swapStockChannelUtils', () => {
  it('normalizes case-insensitive contract addresses in Stock identity keys', () => {
    expect(
      getTokenIdentityKey({
        networkId: 'evm--56',
        contractAddress: '0xAaBb',
      }),
    ).toBe('evm--56:0xaabb:token');
  });

  it('accepts only explicit finite non-negative live execution balances', () => {
    expect(getValidStockExecutionBalance('0')).toBe('0');
    expect(getValidStockExecutionBalance('12.5')).toBe('12.5');
    expect(getValidStockExecutionBalance(undefined)).toBeUndefined();
    expect(getValidStockExecutionBalance('')).toBeUndefined();
    expect(getValidStockExecutionBalance('NaN')).toBeUndefined();
    expect(getValidStockExecutionBalance('Infinity')).toBeUndefined();
    expect(getValidStockExecutionBalance('-1')).toBeUndefined();
  });

  it('uses a valid snapshot for display until a live balance replaces it', () => {
    expect(
      resolveStockDisplayBalance({
        liveBalance: '8',
        snapshotBalance: '5',
      }),
    ).toBe('8');
    expect(resolveStockDisplayBalance({ snapshotBalance: '5' })).toBe('5');
    expect(resolveStockDisplayBalance({})).toBeUndefined();
    expect(
      resolveStockDisplayBalance({ snapshotBalance: 'not-a-balance' }),
    ).toBeUndefined();
  });

  it('requires the exact display owner before publishing an execution balance', () => {
    const params = {
      balance: '12.5',
      displayIdentityKey: 'account-a|stock|pay|buy|usd',
      expectedIdentityKey: 'account-a|stock|pay|buy|usd',
      inputTokenKey: 'network:pay:token',
      loading: false,
    };
    expect(isStockExecutionBalanceScopeReady(params)).toBe(true);
    expect(
      isStockExecutionBalanceScopeReady({
        ...params,
        displayIdentityKey: 'account-b|stock|pay|buy|usd',
      }),
    ).toBe(false);
    expect(
      isStockExecutionBalanceScopeReady({ ...params, loading: true }),
    ).toBe(false);
    expect(
      isStockExecutionBalanceScopeReady({ ...params, balance: undefined }),
    ).toBe(false);
  });

  it('unlocks execution only after the exact live balance reaches the shared atom', () => {
    expect(resolveStockDisplayBalance({ snapshotBalance: '12.5' })).toBe(
      '12.5',
    );
    expect(
      isStockExecutionBalancePublished({
        balance: undefined,
        liveScopeReady: false,
        publishedBalance: '',
      }),
    ).toBe(false);
    expect(
      isStockExecutionBalancePublished({
        balance: '12.5',
        liveScopeReady: true,
        publishedBalance: '12.5',
      }),
    ).toBe(true);
    expect(
      isStockExecutionBalancePublished({
        balance: '1',
        liveScopeReady: true,
        publishedBalance: '99',
      }),
    ).toBe(false);
    expect(
      isStockExecutionBalancePublished({
        balance: '1',
        liveScopeReady: false,
        publishedBalance: '1',
      }),
    ).toBe(false);
  });

  it('loads the default stock when no stock token has been selected', () => {
    expect(
      shouldLoadDefaultStockToken({
        selectedStockTokenKey: '',
      }),
    ).toBe(true);
  });

  it('does not replace stock-owned state with the default stock', () => {
    expect(
      shouldLoadDefaultStockToken({
        selectedStockTokenKey: appleStockToken.contractAddress ?? '',
      }),
    ).toBe(false);
  });

  it('bootstraps the exact cached Stock selection before live channel state lands', () => {
    expect(
      resolveStockChannelBootstrapSelection({
        snapshotSelection: {
          stockToken: appleStockToken,
          payToken: usdcToken,
          tradeSide: ESwapStockTradeSide.Sell,
        },
        stockPair: {},
      }),
    ).toEqual({
      currentStockToken: appleStockToken,
      payToken: usdcToken,
      tradeSide: ESwapStockTradeSide.Sell,
    });
  });

  it('does not leak a cached pay token or side into a different live Stock owner', () => {
    expect(
      resolveStockChannelBootstrapSelection({
        explicitStockToken: micronStockToken,
        snapshotSelection: {
          stockToken: appleStockToken,
          payToken: usdcToken,
          tradeSide: ESwapStockTradeSide.Sell,
        },
        stockPair: {},
      }),
    ).toEqual({
      currentStockToken: micronStockToken,
      payToken: undefined,
      tradeSide: ESwapStockTradeSide.Buy,
    });
  });

  it('keeps the buy-side input skeleton while the default Stock owner is pending', () => {
    expect(
      resolveStockChannelPayTokenStatus({
        payTokenStatus: ESwapStockChannelAsyncStatus.Idle,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Initializing);
    expect(
      resolveStockChannelPayTokenStatus({
        payTokenStatus: ESwapStockChannelAsyncStatus.Idle,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Empty,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Idle);
  });

  it('filters stock pay token candidates to USDC and USDT only', () => {
    expect(
      filterStockPayTokenCandidates([ethToken, usdcToken, usdtToken]).map(
        (token) => token.symbol,
      ),
    ).toEqual(['USDC', 'USDT']);
  });

  it('fails closed when the speed config has no USDC or USDT pay token', () => {
    expect(filterStockPayTokenCandidates([ethToken])).toEqual([]);
  });

  it('does not select an incomplete non-native candidate for a native token', () => {
    expect(
      findTokenFromCandidates({
        candidates: [
          {
            ...ethToken,
            isNative: false,
            speedSwapDefaultAmount: [],
          },
        ],
        token: ethToken,
      }),
    ).toBeUndefined();
  });

  it('does not treat native and incomplete non-native execution pairs as synced', () => {
    expect(
      isStockExecutionPairSynced({
        fromToken: ethToken,
        executionFromToken: { ...ethToken, isNative: false },
        toToken: appleStockToken,
        executionToToken: appleStockToken,
      }),
    ).toBe(false);
  });

  it('resolves a buy-side stock execution pair from swap selected tokens', () => {
    expect(
      resolveStockChannelSwapPair({
        fromToken: usdcToken,
        toToken: appleStockToken,
      }),
    ).toEqual({
      stockToken: appleStockToken,
      payToken: usdcToken,
      tradeSide: ESwapStockTradeSide.Buy,
    });
  });

  it('resolves a sell-side stock execution pair from swap selected tokens', () => {
    expect(
      resolveStockChannelSwapPair({
        fromToken: appleStockToken,
        toToken: usdtToken,
      }),
    ).toEqual({
      stockToken: appleStockToken,
      payToken: usdtToken,
      tradeSide: ESwapStockTradeSide.Sell,
    });
  });

  it('does not resolve ordinary swap tokens as a stock execution pair', () => {
    const ordinarySwapPair = resolveStockChannelSwapPair({
      fromToken: ethToken,
      toToken: usdcToken,
    });

    expect(ordinarySwapPair).toEqual({});
    expect(
      resolveStockChannelOwnedPayToken({
        stockPair: ordinarySwapPair,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    ).toBeUndefined();
  });

  it('resolves a pay token only from an explicitly stock-owned pair', () => {
    const stockPair = resolveStockChannelSwapPair({
      fromToken: usdcToken,
      toToken: appleStockToken,
    });

    expect(
      resolveStockChannelOwnedPayToken({
        stockPair,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    ).toBe(usdcToken);
    expect(
      resolveStockChannelOwnedPayToken({
        stockPair,
        tradeSide: ESwapStockTradeSide.Sell,
      }),
    ).toBeUndefined();
  });

  it('starts canonical Stock balance work only after the exact input owner is ready', () => {
    const readyOwner = {
      displayIdentityKey: 'account-a|stock|pay|buy|usd',
      inputTokenKey: 'network:pay:token',
      inputTokenReady: true,
      inputTokenVisible: true,
    };

    expect(isStockCanonicalInputOwnerReady(readyOwner)).toBe(true);
    expect(
      isStockCanonicalInputOwnerReady({
        ...readyOwner,
        inputTokenReady: false,
      }),
    ).toBe(false);
    expect(
      isStockCanonicalInputOwnerReady({
        ...readyOwner,
        displayIdentityKey: '',
      }),
    ).toBe(false);
    expect(
      isStockCanonicalInputOwnerReady({
        ...readyOwner,
        inputTokenKey: '',
      }),
    ).toBe(false);
  });

  it('keeps the stock K-line token from the stable selected owner', () => {
    expect(
      resolveStockKLineToken({
        stockSelectedToken: appleStockToken,
        executionFromToken: usdcToken,
        fromToken: usdcToken,
        toToken: usdcToken,
      }),
    ).toBe(appleStockToken);
  });

  it('falls back to the stock execution pair for the K-line token', () => {
    expect(
      resolveStockKLineToken({
        executionFromToken: usdcToken,
        executionToToken: appleStockToken,
        fromToken: ethToken,
        toToken: usdcToken,
      }),
    ).toBe(appleStockToken);
  });

  it('falls back to the visible stock pair when execution tokens have no stock', () => {
    expect(
      resolveStockKLineToken({
        executionFromToken: ethToken,
        executionToToken: usdcToken,
        fromToken: usdtToken,
        toToken: appleStockToken,
      }),
    ).toBe(appleStockToken);
  });

  it('resets only the derived receive amount when selecting another stock token', () => {
    expect(
      shouldResetStockTradeReceiveAmount({
        previousStockToken: appleStockToken,
        nextStockToken: micronStockToken,
        resetReceiveAmount: true,
      }),
    ).toBe(true);
  });

  it('keeps stock trade amounts when the selected stock token is unchanged', () => {
    expect(
      shouldResetStockTradeReceiveAmount({
        previousStockToken: appleStockToken,
        nextStockToken: appleStockToken,
        resetReceiveAmount: true,
      }),
    ).toBe(false);
  });

  it('keeps stock trade amounts for initial stock selection or non-reset paths', () => {
    expect(
      shouldResetStockTradeReceiveAmount({
        nextStockToken: appleStockToken,
        resetReceiveAmount: true,
      }),
    ).toBe(false);
    expect(
      shouldResetStockTradeReceiveAmount({
        previousStockToken: appleStockToken,
        nextStockToken: micronStockToken,
      }),
    ).toBe(false);
  });

  it('marks the buy-side pay token ready only after it belongs to the active stock pay-token candidates', () => {
    expect(
      isStockPayTokenReadyForTradeInput({
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        selectablePayTokens: [usdtPayToken],
        stockIdentityReady: true,
      }),
    ).toBe(false);

    expect(
      isStockPayTokenReadyForTradeInput({
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        selectablePayTokens: [usdcPayToken, usdtPayToken],
        stockIdentityReady: true,
      }),
    ).toBe(true);
  });

  it('marks the buy-side pay token not ready while stock or pay-token state is still initializing', () => {
    expect(
      isStockPayTokenReadyForTradeInput({
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        selectablePayTokens: [usdcPayToken],
        stockIdentityReady: false,
      }),
    ).toBe(false);

    expect(
      isStockPayTokenReadyForTradeInput({
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        selectablePayTokens: [usdcPayToken],
        stockIdentityReady: true,
      }),
    ).toBe(false);
  });

  it('keeps Stock quote execution ready when only market detail is unavailable', () => {
    expect(
      isStockTradeReadyForQuote({
        currentStockToken: appleStockToken,
        marketStatusStatus: ESwapStockChannelAsyncStatus.Empty,
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(true);
  });

  it('blocks Stock quote execution only when the market is explicitly closed', () => {
    expect(
      isStockTradeReadyForQuote({
        currentStockToken: appleStockToken,
        marketOpen: false,
        marketStatusStatus: ESwapStockChannelAsyncStatus.Ready,
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(false);
  });

  it('waits for the initial Stock market detail request to settle', () => {
    expect(
      isStockTradeReadyForQuote({
        currentStockToken: appleStockToken,
        marketStatusStatus: ESwapStockChannelAsyncStatus.Initializing,
        payToken: usdcToken,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(false);
  });

  it('keeps the buy-side pay token visible during non-initial readiness refreshes', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenVisible: false,
      }),
    ).toBe(true);

    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenVisible: true,
      }),
    ).toBe(false);
  });

  it('keeps a restored sell-side stock input visible while live readiness settles', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenVisible: true,
      }),
    ).toBe(false);
  });

  it('stops showing the Stock input skeleton after an empty state lands', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Empty,
        inputTokenVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Empty,
        inputTokenVisible: true,
      }),
    ).toBe(false);
  });

  it('marks only stock market tokens as stock swap tokens', () => {
    const stockToken = buildStockSwapTokenFromMarketListToken({
      address: '0xaapl',
      networkId: 'evm--56',
      symbol: 'AAPL',
      name: 'Apple',
      decimals: 18,
      price: '100',
      stock: {
        subtitle: 'Stock',
        sourceLogoUri: '',
        underlyingAssetTicker: 'AAPL',
      },
    });

    expect(stockToken?.isStock).toBe(true);
    expect(stockToken).toMatchObject({
      price: '100',
      currency: 'usd',
    });

    expect(
      buildStockSwapTokenFromMarketListToken({
        address: '0xaapl',
        networkId: 'evm--56',
        symbol: 'AAPL',
        name: 'Apple',
        decimals: 18,
        stock: {
          subtitle: 'Stock',
          sourceLogoUri: '',
          underlyingAssetTicker: 'AAPL',
        },
      })?.isStock,
    ).toBe(true);
  });
});
