export const DiscoveryTestIDs = {
  // Dashboard
  dashboardPage: 'discovery-dashboard-page',
  searchBar: 'explore-index-search', // preserve existing
  bannerCarousel: 'discovery-banner-carousel',
  trendingSection: 'discovery-trending-section',
  bookmarksSection: 'discovery-bookmarks-section',

  // DApp items
  dappSearchItem: (index: number) => `dapp-search${index}`, // preserve existing
  searchModalItem: (title: string) => `search-modal-${title.toLowerCase()}`, // preserve existing

  // Browser tabs
  browserTabItem: (id: string) => `tab-modal-list-item-${id}`, // preserve existing
  newTabButton: 'browser-bar-add', // preserve existing
  tabListButton: 'browser-bar-tabs', // preserve existing

  // Tab actions
  tabActionPin: (isPinned: boolean) =>
    `action-list-item-${!isPinned ? 'pin' : 'un-pin'}`, // preserve existing
  tabActionClose: 'discovery-tab-action-close',
  tabActionBookmark: 'discovery-tab-action-bookmark',

  // Browser navigation
  browserBackButton: 'browser-bar-go-back', // preserve existing
  browserForwardButton: 'browser-bar-go-forward', // preserve existing
  browserRefreshButton: 'browser-bar-refresh', // preserve existing
  browserShareButton: 'discovery-browser-share',

  // Search modal
  searchModalPage: 'discovery-search-modal',
  searchInput: 'discovery-search-input',

  // History
  historyListPage: 'discovery-history-list-page',

  // Page translation
  pageTranslationRetryBtn: 'discovery-page-translation-retry-btn',
  pageTranslationSwitchEngineBtn:
    'discovery-page-translation-switch-engine-btn',
} as const;
