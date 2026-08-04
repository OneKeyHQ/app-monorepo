import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockTradeSide,
  SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES,
  backfillSwapProTokenStockIdentity,
  buildStockPayTokenDisplaySeed,
  buildStockSwapTokenFromMarketListToken,
  filterStockPayTokenCandidates,
  hasValidStockBalanceForTrade,
  isStockBalanceActionReady,
  isStockBalanceInitializing,
  isStockPayTokenReadyForTradeInput,
  isStockTradeReadyForQuote,
  resolveStockBalanceSeed,
  resolveStockBalanceSnapshot,
  resolveStockBalanceViewState,
  resolveStockChannelSwapPair,
  resolveStockExecutionTokenMetadata,
  resolveStockExecutionTokensForTradeSideSwitch,
  resolveStockExecutionTokensToSync,
  resolveStockKLineToken,
  resolveStockPayTokenDisplaySeed,
  resolveStockPayTokenState,
  resolveStockTradeInputTokenStatus,
  resolveSwapStockDefaultTokenStatus,
  shouldLoadDefaultStockToken,
  shouldRenderStockTradeInputSkeleton,
  shouldResetStockTradeReceiveAmount,
  upsertSwapStockPayTokenScopeCache,
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

  it('keeps default Stock selection pending while config or token scope is unsettled', () => {
    const baseParams = {
      hasSelectableToken: false,
      hasStockCategory: true,
      marketBasicConfigLoading: false,
      requestScope: '1:stocks',
      resultScope: '1:stocks',
      shouldLoad: true,
    };
    const coldStartStatuses = [
      resolveSwapStockDefaultTokenStatus({
        ...baseParams,
        marketBasicConfigLoading: undefined,
        requestScope: '1:',
        resultScope: '',
      }),
      resolveSwapStockDefaultTokenStatus({
        ...baseParams,
        marketBasicConfigLoading: true,
        requestScope: '1:',
        resultScope: '',
      }),
      resolveSwapStockDefaultTokenStatus({
        ...baseParams,
        isLoading: false,
        resultScope: '1:',
      }),
      resolveSwapStockDefaultTokenStatus({
        ...baseParams,
        isLoading: true,
      }),
      resolveSwapStockDefaultTokenStatus({
        ...baseParams,
        hasSelectableToken: true,
        isLoading: false,
      }),
    ];

    expect(coldStartStatuses).toEqual([
      ESwapStockChannelAsyncStatus.Initializing,
      ESwapStockChannelAsyncStatus.Initializing,
      ESwapStockChannelAsyncStatus.Initializing,
      ESwapStockChannelAsyncStatus.Initializing,
      ESwapStockChannelAsyncStatus.Initializing,
    ]);
    expect(coldStartStatuses).not.toContain(ESwapStockChannelAsyncStatus.Empty);
  });

  it('settles when Market config finishes without a Stock category', () => {
    expect(
      resolveSwapStockDefaultTokenStatus({
        hasSelectableToken: false,
        hasStockCategory: false,
        isLoading: false,
        marketBasicConfigLoading: false,
        requestScope: '1:',
        resultScope: '1:',
        shouldLoad: true,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Empty);
  });

  it('settles default Stock selection only for the current empty scope', () => {
    expect(
      resolveSwapStockDefaultTokenStatus({
        hasSelectableToken: false,
        hasStockCategory: true,
        isLoading: false,
        marketBasicConfigLoading: false,
        requestScope: '1:stocks',
        resultScope: '1:stocks',
        shouldLoad: true,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Empty);
    expect(
      resolveSwapStockDefaultTokenStatus({
        hasSelectableToken: false,
        hasStockCategory: true,
        isLoading: false,
        marketBasicConfigLoading: false,
        requestScope: '0:stocks',
        resultScope: '1:stocks',
        shouldLoad: false,
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

  it('restores the persisted pay token as a display seed before execution state is ready', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        candidates: [usdcPayToken, usdtPayToken],
        persistedTokenKey: 'evm--56:0xusdt:token',
      }),
    ).toBe(usdtPayToken);
  });

  it('restores a full persisted pay-token seed while live candidates are unavailable', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        allowPersistedTokenFallback: true,
        candidates: [],
        persistedToken: usdtToken,
      }),
    ).toBe(usdtToken);
  });

  it('reconciles a persisted display seed to the live pay-token candidate', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        candidates: [usdcPayToken, usdtPayToken],
        persistedToken: usdtToken,
      }),
    ).toBe(usdtPayToken);
  });

  it('ignores an unsupported persisted display seed', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        allowPersistedTokenFallback: true,
        candidates: [],
        persistedToken: ethToken,
      }),
    ).toBeUndefined();
  });

  it('drops the persisted display seed after live candidates settle empty', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        allowPersistedTokenFallback: false,
        candidates: [],
        persistedToken: usdtToken,
      }),
    ).toBeUndefined();
  });

  it('stores only presentation fields in the persisted pay-token seed', () => {
    expect(
      buildStockPayTokenDisplaySeed({
        ...usdtToken,
        accountAddress: '0xaccount',
        balanceParsed: '10',
        fiatValue: '10',
        logoURI: 'https://example.com/usdt.png',
        networkLogoURI: 'https://example.com/bsc.png',
        price: '1',
      }),
    ).toEqual({
      networkId: 'evm--56',
      contractAddress: '0xusdt',
      decimals: 6,
      isNative: undefined,
      symbol: 'USDT',
      name: undefined,
      logoURI: 'https://example.com/usdt.png',
      networkLogoURI: 'https://example.com/bsc.png',
    });
  });

  it('keeps the selected pay token ahead of the persisted display preference', () => {
    expect(
      resolveStockPayTokenDisplaySeed({
        candidates: [usdcPayToken, usdtPayToken],
        persistedTokenKey: 'evm--56:0xusdt:token',
        selectedToken: usdcToken,
      }),
    ).toBe(usdcPayToken);
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
    expect(
      resolveStockChannelSwapPair({
        fromToken: ethToken,
        toToken: usdcToken,
      }),
    ).toEqual({});
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

  it('keeps a display-only cached pay token out of execution until live readiness', () => {
    expect(
      resolveStockExecutionTokensToSync({
        currentFromToken: usdtToken,
        currentToToken: appleStockToken,
        payToken: usdcToken,
        readyForQuote: false,
        stockToken: appleStockToken,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    ).toBeUndefined();

    expect(
      resolveStockExecutionTokensToSync({
        currentFromToken: usdcToken,
        currentToToken: appleStockToken,
        payToken: usdtToken,
        readyForQuote: true,
        stockToken: appleStockToken,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    ).toEqual({
      fromToken: usdtToken,
      toToken: appleStockToken,
    });
  });

  it('refreshes Stock execution metadata from an identity-matched token detail', () => {
    const cachedStockToken = {
      ...appleStockToken,
      decimals: 0,
    };
    const tokenDetail = {
      ...appleStockToken,
      balanceParsed: '0.168058487842240859',
    };

    expect(
      resolveStockExecutionTokenMetadata({
        token: cachedStockToken,
        tokenDetail,
      }),
    ).toEqual(appleStockToken);
    expect(
      resolveStockExecutionTokenMetadata({
        token: cachedStockToken,
        tokenDetail: {
          ...tokenDetail,
          contractAddress: micronStockToken.contractAddress,
        },
      }),
    ).toBeUndefined();
  });

  it('resyncs Stock execution tokens when only authoritative metadata changes', () => {
    const cachedStockToken = {
      ...appleStockToken,
      decimals: 0,
    };

    expect(
      resolveStockExecutionTokensToSync({
        currentFromToken: cachedStockToken,
        currentToToken: usdcToken,
        payToken: usdcToken,
        readyForQuote: true,
        stockToken: appleStockToken,
        tradeSide: ESwapStockTradeSide.Sell,
      }),
    ).toEqual({
      fromToken: appleStockToken,
      toToken: usdcToken,
    });
  });

  it('does not build trade-side execution tokens without a live pay token', () => {
    expect(
      resolveStockExecutionTokensForTradeSideSwitch({
        stockToken: appleStockToken,
      }),
    ).toBeUndefined();
    expect(
      resolveStockExecutionTokensForTradeSideSwitch({
        payToken: usdcPayToken,
        stockToken: appleStockToken,
      }),
    ).toEqual({
      payToken: usdcPayToken,
      stockToken: appleStockToken,
    });
  });

  it('bounds account-scoped pay-token caches and retains recent writes', () => {
    let cache: Record<string, string> = {};
    for (
      let index = 0;
      index <= SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES;
      index += 1
    ) {
      cache = upsertSwapStockPayTokenScopeCache({
        cache,
        scope: `scope-${index}`,
        value: `token-${index}`,
      });
    }

    expect(Object.keys(cache)).toHaveLength(
      SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES,
    );
    expect(cache['scope-0']).toBeUndefined();
    expect(cache['scope-1']).toBe('token-1');
    expect(cache[`scope-${SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES}`]).toBe(
      `token-${SWAP_STOCK_PAY_TOKEN_SCOPE_CACHE_MAX_ENTRIES}`,
    );

    cache = upsertSwapStockPayTokenScopeCache({
      cache,
      scope: 'scope-1',
      value: 'token-1-updated',
    });
    expect(Object.keys(cache).at(-1)).toBe('scope-1');
    expect(cache['scope-1']).toBe('token-1-updated');
  });

  it('keeps the buy-side pay token visible during non-initial readiness refreshes', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenReady: false,
        inputTokenVisible: false,
        isBuySide: true,
      }),
    ).toBe(true);

    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenReady: false,
        inputTokenVisible: true,
        isBuySide: true,
      }),
    ).toBe(false);
  });

  it('uses an ordinary Swap pay token only as a selection hint until Stock confirms it', () => {
    const initializingState = resolveStockPayTokenState({
      swapPairToken: usdcToken,
    });
    expect(initializingState).toEqual({
      displayToken: undefined,
      selectionToken: usdcToken,
    });

    expect(
      resolveStockPayTokenState({
        liveToken: usdcPayToken,
        swapPairToken: usdcToken,
      }),
    ).toEqual({
      displayToken: usdcPayToken,
      selectionToken: usdcToken,
    });

    expect(
      resolveStockPayTokenState({
        coldStartToken: usdtToken,
        swapPairToken: usdcToken,
      }),
    ).toEqual({
      displayToken: usdtToken,
      selectionToken: usdtToken,
    });
  });

  it('keeps the buy-side input initializing until the stock identity is ready', () => {
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: true,
        payTokenStatus: ESwapStockChannelAsyncStatus.Idle,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Initializing);
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: true,
        payTokenStatus: ESwapStockChannelAsyncStatus.Idle,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Initializing);
  });

  it('settles the buy-side input only after its owning state settles', () => {
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: true,
        payTokenStatus: ESwapStockChannelAsyncStatus.Idle,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Empty,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Empty);
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: true,
        payTokenStatus: ESwapStockChannelAsyncStatus.Empty,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Empty);
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: true,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Ready);
  });

  it('keeps the sell-side input owned by the stock-token status', () => {
    expect(
      resolveStockTradeInputTokenStatus({
        isBuySide: false,
        payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
        stockTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
      }),
    ).toBe(ESwapStockChannelAsyncStatus.Initializing);
  });

  it('shows Stock balance loading only before the first scoped balance lands', () => {
    expect(
      isStockBalanceInitializing({
        balance: undefined,
        requestPending: true,
      }),
    ).toBe(true);
    expect(
      isStockBalanceInitializing({
        balance: '12.34',
        requestPending: true,
      }),
    ).toBe(false);
    expect(
      isStockBalanceInitializing({
        balance: '0',
        requestPending: true,
      }),
    ).toBe(false);
  });

  it('accepts only finite non-negative live balances for Stock trading', () => {
    expect(hasValidStockBalanceForTrade('0')).toBe(true);
    expect(hasValidStockBalanceForTrade('1.25')).toBe(true);
    expect(hasValidStockBalanceForTrade(undefined)).toBe(false);
    expect(hasValidStockBalanceForTrade('')).toBe(false);
    expect(hasValidStockBalanceForTrade('invalid')).toBe(false);
    expect(hasValidStockBalanceForTrade('-1')).toBe(false);
  });

  it('uses a Stock balance seed only when it belongs to the active account', () => {
    const tokenWithBalanceOwner: ISwapToken = {
      ...usdcToken,
      accountAddress: '0xAccountA',
      balanceParsed: '0.24',
    };

    expect(
      resolveStockBalanceSeed({
        hasActiveAccount: true,
        networkAccountAddress: '0xaccounta',
        token: tokenWithBalanceOwner,
      }),
    ).toBe('0.24');
    expect(
      resolveStockBalanceSeed({
        hasActiveAccount: true,
        networkAccountAddress: '0xAccountB',
        token: tokenWithBalanceOwner,
      }),
    ).toBeUndefined();
    expect(
      resolveStockBalanceSeed({
        hasActiveAccount: true,
        token: tokenWithBalanceOwner,
      }),
    ).toBeUndefined();
    expect(
      resolveStockBalanceSeed({
        hasActiveAccount: true,
        networkAccountAddress: '0xAccountA',
        token: {
          ...usdcToken,
          balanceParsed: '0.24',
        },
      }),
    ).toBeUndefined();
  });

  it('keeps an unscoped Stock balance seed when no account is active', () => {
    expect(
      resolveStockBalanceSeed({
        hasActiveAccount: false,
        token: {
          ...usdcToken,
          balanceParsed: '0.24',
        },
      }),
    ).toBe('0.24');
  });

  it('keeps a scoped Stock balance visible from seed through authoritative refresh', () => {
    const seededSnapshot = resolveStockBalanceSnapshot({
      ownerScope: 'account-1:usdc',
      seededBalance: '0.24',
      seededTokenDetail: usdcToken,
    });
    expect(seededSnapshot).toEqual({
      ownerScope: 'account-1:usdc',
      balance: '0.24',
      tokenDetail: usdcToken,
    });

    expect(
      resolveStockBalanceSnapshot({
        ownerScope: 'account-1:usdc',
        previousSnapshot: seededSnapshot,
        seededBalance: '0.10',
      }),
    ).toBe(seededSnapshot);

    expect(
      resolveStockBalanceSnapshot({
        authoritativeBalance: '0.25',
        authoritativeTokenDetail: usdcToken,
        ownerScope: 'account-1:usdc',
        previousSnapshot: seededSnapshot,
      }),
    ).toEqual({
      ownerScope: 'account-1:usdc',
      balance: '0.25',
      tokenDetail: usdcToken,
    });
  });

  it('does not reuse a Stock balance snapshot across owner scopes', () => {
    expect(
      resolveStockBalanceSnapshot({
        ownerScope: 'account-2:usdc',
        previousSnapshot: {
          ownerScope: 'account-1:usdc',
          balance: '0.24',
          tokenDetail: usdcToken,
        },
      }),
    ).toBeUndefined();
  });

  it('keeps cached and seeded balances display-only until live balance is ready', () => {
    expect(
      resolveStockBalanceViewState({
        balanceSnapshot: {
          ownerScope: 'account-1:usdc',
          balance: '0.24',
          tokenDetail: usdcToken,
        },
        cachedDisplayBalance: '0.24',
      }),
    ).toEqual({
      balance: undefined,
      displayBalance: '0.24',
      tokenDetail: usdcToken,
    });

    expect(
      resolveStockBalanceViewState({
        authoritativeBalance: '0.25',
        balanceSnapshot: {
          ownerScope: 'account-1:usdc',
          balance: '0.25',
          tokenDetail: usdcToken,
        },
        cachedDisplayBalance: '0.24',
      }),
    ).toEqual({
      balance: '0.25',
      displayBalance: '0.25',
      tokenDetail: usdcToken,
    });
  });

  it('keeps balance actions unavailable until authoritative execution state is ready', () => {
    expect(
      isStockBalanceActionReady({
        authoritativeBalance: undefined,
        authoritativeStockToken: appleStockToken,
        isBuySide: false,
      }),
    ).toBe(false);
    expect(
      isStockBalanceActionReady({
        authoritativeBalance: '0.24',
        isBuySide: false,
      }),
    ).toBe(false);
    expect(
      isStockBalanceActionReady({
        authoritativeBalance: '0.24',
        authoritativeStockToken: appleStockToken,
        isBuySide: false,
      }),
    ).toBe(true);
    expect(
      isStockBalanceActionReady({
        authoritativeBalance: '0.24',
        isBuySide: true,
      }),
    ).toBe(true);
  });

  it('keeps sell-side stock input skeleton tied to full readiness', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Initializing,
        inputTokenReady: false,
        inputTokenVisible: true,
        isBuySide: false,
      }),
    ).toBe(true);
  });

  it('stops showing the Stock input skeleton after an empty state lands', () => {
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Empty,
        inputTokenReady: false,
        inputTokenVisible: false,
        isBuySide: true,
      }),
    ).toBe(false);
    expect(
      shouldRenderStockTradeInputSkeleton({
        inputTokenStatus: ESwapStockChannelAsyncStatus.Empty,
        inputTokenReady: false,
        inputTokenVisible: true,
        isBuySide: false,
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

describe('backfillSwapProTokenStockIdentity', () => {
  const stockDetail = {
    networkId: 'evm--56',
    address: '0xstock',
    stock: {
      subtitle: 'Stock',
      sourceLogoUri: '',
      underlyingAssetTicker: 'AAPL',
    },
  } as unknown as Parameters<
    typeof backfillSwapProTokenStockIdentity
  >[0]['tokenDetail'];
  const legacyStockToken: ISwapToken = {
    // Persisted before the isStock field existed — no isStock key at all.
    networkId: 'evm--56',
    contractAddress: '0xstock',
    symbol: 'AAPLX',
    decimals: 18,
  };

  it('backfills a legacy record without isStock from the matching detail', () => {
    const result = backfillSwapProTokenStockIdentity({
      token: legacyStockToken,
      tokenDetail: stockDetail,
    });
    expect(result).not.toBe(legacyStockToken);
    expect(result?.isStock).toBe(true);
  });

  it('writes an explicit false once for legacy non-stock records', () => {
    const detailWithoutStock = {
      networkId: 'evm--56',
      address: '0xstock',
    } as unknown as Parameters<
      typeof backfillSwapProTokenStockIdentity
    >[0]['tokenDetail'];
    const result = backfillSwapProTokenStockIdentity({
      token: legacyStockToken,
      tokenDetail: detailWithoutStock,
    });
    expect(result).not.toBe(legacyStockToken);
    expect(result?.isStock).toBe(false);
  });

  it('ignores a stale detail describing another token', () => {
    const result = backfillSwapProTokenStockIdentity({
      token: { ...legacyStockToken, contractAddress: '0xother' },
      tokenDetail: stockDetail,
    });
    expect(result?.isStock).toBeUndefined();
  });

  it('returns the same reference when the flag is already explicit and correct', () => {
    const migratedToken: ISwapToken = {
      ...legacyStockToken,
      isStock: true,
    };
    expect(
      backfillSwapProTokenStockIdentity({
        token: migratedToken,
        tokenDetail: stockDetail,
      }),
    ).toBe(migratedToken);
  });

  it('passes tokens through untouched while the detail has not loaded', () => {
    expect(
      backfillSwapProTokenStockIdentity({
        token: legacyStockToken,
        tokenDetail: undefined,
      }),
    ).toBe(legacyStockToken);
  });
});
