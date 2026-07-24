export const EarnTestIDs = {
  // Main page
  earnPage: 'earn-page',
  borrowEntryButton: 'earn-borrow-entry-button',
  homeShortcut: (name: string) => `earn-home-shortcut-${name}`,

  // Tabs
  tabProtocols: 'earn-tab-protocols',
  tabPortfolio: 'earn-tab-portfolio',
  tabAvailableAssets: 'earn-tab-available-assets',

  // Protocol list
  protocolItem: (name: string) => `earn-protocol-${name}`,
  protocolStakeButton: (name: string) => `earn-protocol-stake-${name}`,
  protocolNetworkFilter: 'earn-protocol-network-filter',
  protocolSort: 'earn-protocol-sort',
  protocolSortOption: (key: string, direction: string) =>
    `earn-protocol-sort-${key}-${direction}`,

  // Portfolio
  portfolioOverview: 'earn-portfolio-overview',
  portfolioEntry: 'earn-portfolio-entry',
  portfolioItem: (name: string) => `earn-portfolio-item-${name}`,

  // Available assets
  assetItem: (symbol: string) => `earn-asset-${symbol}`,
  flatAssetItem: (category: string, symbol: string) =>
    `earn-flat-asset-${category}-${symbol}`,
  flatAssetCategoryEntry: (category: string) =>
    `earn-flat-asset-category-entry-${category}`,
  flatAssetCategoryDialog: (category: string) =>
    `earn-flat-asset-category-dialog-${category}`,
  flatAssetDialogItem: (category: string, symbol: string) =>
    `earn-flat-asset-dialog-${category}-${symbol}`,
  assetSearchInput: 'earn-asset-search-input',
  marketSelector: 'earn-market-selector',

  // Staking actions
  stakeButton: 'earn-stake-button',
  unstakeButton: 'earn-unstake-button',
  claimButton: 'earn-claim-button',
  amountInput: 'earn-amount-input',
  maxButton: 'earn-max-button',

  // Banner
  banner: 'earn-banner',
  bannerItem: (bannerId: string) => `earn-banner-${bannerId}`,
  bannerButton: (bannerId: string) => `earn-banner-button-${bannerId}`,

  // FAQ
  faqSection: 'earn-faq-section',

  // Risk notice
  riskNoticeDialog: 'earn-risk-notice-dialog',
  riskNoticeConfirmButton: 'earn-risk-notice-confirm',

  // Protocol intro section
  protocolIntroLinkButton: (title: string) =>
    `earn-protocol-intro-link-${title}`,
  protocolIntroAuditButton: (title: string) =>
    `earn-protocol-intro-audit-${title}`,

  // Network filter
  networkFilterResetButton: 'earn-network-filter-reset-button',
  networkFilterAllCheckbox: 'earn-network-filter-checkbox-all',
  networkFilterCheckbox: (id: string) => `earn-network-filter-checkbox-${id}`,
} as const;
