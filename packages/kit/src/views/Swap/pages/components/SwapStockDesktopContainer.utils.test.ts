import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import {
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from '../../hooks/swapStockChannelUtils';

import {
  STOCK_CHART_DEFAULT_RANGE,
  STOCK_CHART_RANGE_ITEMS,
  STOCK_DESKTOP_HEADER_SLOT_PROPS,
  getStockChartCoinGeckoIdState,
  getStockChartDisplayState,
  getStockDisabledActionButtonProps,
  getStockMarketTokenSubtitle,
  getStockNetworkLogoUri,
  isStockMarketPanelLoadingStage,
  mergeStockChartRealtimePoint,
  shouldShowStockMarketHeaderSkeleton,
  shouldShowStockQuoteActionLoading,
} from './SwapStockDesktopContainer.utils';

describe('SwapStockDesktopContainer utils', () => {
  it('defaults the stock chart range to one week', () => {
    expect(STOCK_CHART_DEFAULT_RANGE).toBe('1W');
  });

  it('keeps one month as a selectable stock chart range', () => {
    expect(
      STOCK_CHART_RANGE_ITEMS.some((item) => item.label === '1M'),
    ).toBeTruthy();
  });

  it('uses the shared desktop header slot spacing for stock layout', () => {
    expect(STOCK_DESKTOP_HEADER_SLOT_PROPS).toEqual({
      width: '100%',
      alignItems: 'center',
      pt: '$8',
      pb: '$4',
    });
  });

  it('resolves the preset Stock network logo before async network data arrives', () => {
    expect(
      getStockNetworkLogoUri({
        networkId: 'evm--56',
      }),
    ).toBe('https://uni.onekey-asset.com/static/chain/bsc.png');
  });

  it('keeps the token-provided Stock network logo when available', () => {
    expect(
      getStockNetworkLogoUri({
        networkId: 'evm--56',
        networkLogoUri: 'https://example.com/custom-network.png',
      }),
    ).toBe('https://example.com/custom-network.png');
  });

  it('settles the CoinGecko lookup when the fallback has no id', () => {
    const tokenScope = 'evm--1:0xstock';

    expect(
      getStockChartCoinGeckoIdState({
        networkId: 'evm--1',
        tokenScope,
      }),
    ).toEqual({
      coinGeckoId: undefined,
      isLoading: true,
    });
    expect(
      getStockChartCoinGeckoIdState({
        lookupResult: {
          tokenScope,
          coinGeckoId: undefined,
        },
        networkId: 'evm--1',
        tokenScope,
      }),
    ).toEqual({
      coinGeckoId: undefined,
      isLoading: false,
    });
  });

  it('ignores a completed CoinGecko lookup from another token scope', () => {
    expect(
      getStockChartCoinGeckoIdState({
        lookupResult: {
          tokenScope: 'evm--1:0xprevious',
          coinGeckoId: 'previous-stock',
        },
        networkId: 'evm--1',
        tokenScope: 'evm--1:0xcurrent',
      }),
    ).toEqual({
      coinGeckoId: undefined,
      isLoading: true,
    });
  });

  it('prefers the token detail CoinGecko id without waiting for fallback', () => {
    expect(
      getStockChartCoinGeckoIdState({
        lookupResult: {
          tokenScope: 'evm--1:0xstock',
          coinGeckoId: undefined,
        },
        networkId: 'evm--1',
        tokenDetailCoinGeckoId: 'stock-detail-id',
        tokenScope: 'evm--1:0xstock',
      }),
    ).toEqual({
      coinGeckoId: 'stock-detail-id',
      isLoading: false,
    });
  });

  it('keeps disabled buy actions in the buy color family', () => {
    expect(
      getStockDisabledActionButtonProps(
        ESwapStockTradeSide.Buy,
        ESwapStockChannelStage.MissingPayToken,
      ),
    ).toEqual({
      bg: '$bgSuccessStrong',
      color: '$textOnColor',
      disabledStyle: {
        opacity: 0.6,
      },
    });
  });

  it('keeps disabled sell actions in the sell color family', () => {
    expect(
      getStockDisabledActionButtonProps(
        ESwapStockTradeSide.Sell,
        ESwapStockChannelStage.MissingPayToken,
      ),
    ).toEqual({
      bg: '$bgCriticalStrong',
      color: '$textOnColor',
      disabledStyle: {
        opacity: 0.6,
      },
    });
  });

  it('keeps market-status loading actions neutral', () => {
    expect(
      getStockDisabledActionButtonProps(
        ESwapStockTradeSide.Buy,
        ESwapStockChannelStage.CheckingMarketStatus,
      ),
    ).toBeUndefined();
  });

  it('shows market panel skeletons while Stock identity or detail initializes', () => {
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.InitializingStock),
    ).toBe(true);
    expect(
      isStockMarketPanelLoadingStage(
        ESwapStockChannelStage.CheckingMarketStatus,
      ),
    ).toBe(true);
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.MissingStock),
    ).toBe(false);
    expect(
      isStockMarketPanelLoadingStage(ESwapStockChannelStage.MarketUnavailable),
    ).toBe(false);
  });

  it('keeps the Stock header mounted while only market detail is loading', () => {
    expect(
      shouldShowStockMarketHeaderSkeleton({
        channelStage: ESwapStockChannelStage.InitializingStock,
        hasStockIdentity: false,
      }),
    ).toBe(true);
    expect(
      shouldShowStockMarketHeaderSkeleton({
        channelStage: ESwapStockChannelStage.CheckingMarketStatus,
        hasStockIdentity: true,
      }),
    ).toBe(false);
    expect(
      shouldShowStockMarketHeaderSkeleton({
        channelStage: ESwapStockChannelStage.MissingStock,
        hasStockIdentity: false,
      }),
    ).toBe(false);
  });

  it('keeps the selected localized Stock subtitle while detail loads', () => {
    expect(
      getStockMarketTokenSubtitle({
        currentStockSubtitle: '英特尔',
        currentTokenName: 'Intel (Ondo Tokenized)',
        hasTokenDetail: false,
      }),
    ).toBe('英特尔');
  });

  it('prefers the localized detail subtitle after detail loads', () => {
    expect(
      getStockMarketTokenSubtitle({
        currentStockSubtitle: '英特尔',
        currentTokenName: 'Intel (Ondo Tokenized)',
        hasTokenDetail: true,
        tokenDetailStockSubtitle: '英特尔公司',
      }),
    ).toBe('英特尔公司');
  });

  it('falls back to the raw token name only before Stock metadata loads', () => {
    expect(
      getStockMarketTokenSubtitle({
        currentTokenName: 'Intel (Ondo Tokenized)',
        hasTokenDetail: false,
      }),
    ).toBe('Intel (Ondo Tokenized)');
    expect(
      getStockMarketTokenSubtitle({
        currentTokenName: 'Intel (Ondo Tokenized)',
        hasTokenDetail: true,
      }),
    ).toBeUndefined();
  });

  it('shows Stock action loading until the current quote event settles', () => {
    const baseParams = {
      inputAmount: '100',
      quoteEventCompleted: false,
      quoteRequestMatchesStockTrade: true,
    };

    expect(shouldShowStockQuoteActionLoading(baseParams)).toBe(true);
    expect(
      shouldShowStockQuoteActionLoading({
        ...baseParams,
        quoteRequestMatchesStockTrade: false,
      }),
    ).toBe(true);
    expect(
      shouldShowStockQuoteActionLoading({
        ...baseParams,
        quoteEventCompleted: true,
      }),
    ).toBe(false);
  });

  it('keeps loading from a new input through its current quote request', () => {
    const transitionStates = [
      {
        inputAmount: '100',
        quoteEventCompleted: true,
        quoteRequestMatchesStockTrade: false,
      },
      {
        inputAmount: '100',
        quoteEventCompleted: false,
        quoteRequestMatchesStockTrade: true,
      },
      {
        inputAmount: '100',
        quoteEventCompleted: true,
        quoteRequestMatchesStockTrade: true,
      },
    ];

    expect(transitionStates.map(shouldShowStockQuoteActionLoading)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('does not turn current terminal or empty-input states into loading', () => {
    expect(
      shouldShowStockQuoteActionLoading({
        inputAmount: '100',
        quoteEventCompleted: true,
        quoteRequestMatchesStockTrade: true,
      }),
    ).toBe(false);
    expect(
      shouldShowStockQuoteActionLoading({
        inputAmount: '',
        quoteEventCompleted: false,
        quoteRequestMatchesStockTrade: false,
      }),
    ).toBe(false);
  });

  it('keeps the chart in loading state when only realtime price has arrived', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: false,
        isLoading: true,
        realtimeChartPoint: [1_725_000_000, 312.15],
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartError: false,
      shouldShowChartLoading: true,
    });
  });

  it('keeps a current pending chart request in loading state', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: true,
        isLoading: false,
        requestStatus: 'pending',
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartError: false,
      shouldShowChartLoading: true,
    });
  });

  it('shows chart errors separately from successful empty responses', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: true,
        isLoading: false,
        requestStatus: 'error',
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartError: true,
      shouldShowChartLoading: false,
    });
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: true,
        isLoading: false,
        requestStatus: 'success',
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartError: false,
      shouldShowChartLoading: false,
    });
  });

  it('shows loading instead of a stale error while retrying', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [],
        isChartStateForCurrentScope: true,
        isLoading: true,
        requestStatus: 'error',
      }),
    ).toEqual({
      chartData: [],
      shouldShowChartError: false,
      shouldShowChartLoading: true,
    });
  });

  it('keeps previous chart data visible during a same-asset refresh', () => {
    const previousChartData: IMarketTokenChart = [
      [1_725_000_000, 310],
      [1_725_003_600, 311],
    ];

    expect(
      getStockChartDisplayState({
        baseChartData: [...previousChartData],
        isChartStateForCurrentScope: false,
        isLoading: true,
        realtimeChartPoint: [1_725_007_200, 312.15],
      }),
    ).toEqual({
      chartData: previousChartData,
      shouldShowChartError: false,
      shouldShowChartLoading: false,
    });
  });

  it('keeps a cached current-scope chart visible while revalidating', () => {
    const cachedChartData: IMarketTokenChart = [
      [1_725_000_000, 310],
      [1_725_003_600, 311],
    ];

    expect(
      getStockChartDisplayState({
        baseChartData: cachedChartData,
        isChartStateForCurrentScope: true,
        isLoading: true,
      }),
    ).toEqual({
      chartData: cachedChartData,
      shouldShowChartError: false,
      shouldShowChartLoading: false,
    });
  });

  it('merges realtime stock points only after chart data matches the active range', () => {
    expect(
      getStockChartDisplayState({
        baseChartData: [
          [1_725_000_000, 310],
          [1_725_003_600, 311],
        ],
        isChartStateForCurrentScope: true,
        isLoading: false,
        realtimeChartPoint: [1_725_007_200, 312.15],
      }),
    ).toEqual({
      chartData: [
        [1_725_000_000, 310],
        [1_725_003_600, 311],
        [1_725_007_200, 312.15],
      ],
      shouldShowChartError: false,
      shouldShowChartLoading: false,
    });
  });

  it('merges realtime stock points into existing chart data by timestamp', () => {
    expect(
      mergeStockChartRealtimePoint({
        baseChartData: [
          [1_725_003_600_000, 311],
          [1_725_000_000, 310],
        ],
        realtimeChartPoint: [1_725_003_600, 312.15],
      }),
    ).toEqual([
      [1_725_000_000, 310],
      [1_725_003_600, 312.15],
    ]);
  });

  it('ignores invalid realtime stock points', () => {
    const chartData: IMarketTokenChart = [[1_725_000_000, 310]];

    expect(
      mergeStockChartRealtimePoint({
        baseChartData: chartData,
        realtimeChartPoint: [1_725_003_600, Number.NaN],
      }),
    ).toBe(chartData);
  });
});
