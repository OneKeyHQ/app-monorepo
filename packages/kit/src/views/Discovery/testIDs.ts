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
  browserTabItem: (id: string) => `discovery-browser-tab-${id}`,
  newTabButton: 'discovery-new-tab-button',
  tabListButton: 'discovery-tab-list-button',

  // Tab actions
  tabActionPin: (isPinned: boolean) =>
    `action-list-item-${!isPinned ? 'pin' : 'un-pin'}`, // preserve existing
  tabActionClose: 'discovery-tab-action-close',
  tabActionBookmark: 'discovery-tab-action-bookmark',

  // Browser navigation
  browserBackButton: 'discovery-browser-back',
  browserForwardButton: 'discovery-browser-forward',
  browserRefreshButton: 'discovery-browser-refresh',
  browserShareButton: 'discovery-browser-share',

  // Search modal
  searchModalPage: 'discovery-search-modal',
  searchInput: 'discovery-search-input',

  // History
  historyListPage: 'discovery-history-list-page',
} as const;
