export const MarketTestIDs = {
  // Main page
  marketPage: 'market-page',
  searchBar: 'market-search-bar',

  // Token list
  tokenListItem: (symbol: string) => `market-token-item-${symbol}`,
  tokenStarButton: (symbol: string) => `market-token-star-${symbol}`,

  // Watchlist
  watchList: 'market-watch-list',

  // Sort controls
  sortByPrice: 'market-sort-price',
  sortByChange: 'market-sort-change',
  sortByMarketCap: 'market-sort-market-cap',
  sortByVolume: 'market-sort-volume',

  // Token detail
  detailPage: 'market-detail-page',
  detailChart: 'market-detail-chart',
  detailBuyButton: 'market-detail-buy-button',
  detailSwapButton: 'market-detail-swap-button',
  detailAbout: 'market-detail-about',
  detailNotificationButton: 'market-banner-detail-notification', // preserve existing

  // Chart time range
  chartTimeRange: (range: string) => `market-chart-range-${range}`,

  // Market preset selector (slippage/priority fee for swap)
  presetSelectorOkBtn: 'market-preset-selector-ok-btn',
  presetSelectorResetBtn: 'market-preset-selector-reset-btn',
  presetSelectorConfirmBtn: 'market-preset-selector-confirm-btn',
  presetSelectorSlippagePresetBtn: (value: string | number) =>
    `market-preset-selector-slippage-preset-${value}-btn`,
  presetSelectorPriorityFeeCustomInput:
    'market-preset-selector-priority-fee-custom-input',

  // Token liquidity pools row
  liquidityPoolCopyAddressBtn: 'market-liquidity-pool-copy-address-btn',
  liquidityPoolOpenAddressBtn: 'market-liquidity-pool-open-address-btn',

  // Token selector row
  tokenSelectorRowStarBtn: 'market-token-selector-row-star-btn',

  // List row trade actions (MarketListTradeButton)
  listConnectBtn: 'market-list-connect-btn',
  listTradeBtn: 'market-list-trade-btn',
  listBuyBtn: 'market-list-buy-btn',
  listEarnBtn: 'market-list-earn-btn',
} as const;
