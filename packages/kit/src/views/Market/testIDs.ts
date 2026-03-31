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
} as const;
