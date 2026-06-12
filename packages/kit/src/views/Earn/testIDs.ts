export const EarnTestIDs = {
  // Main page
  earnPage: 'earn-page',

  // Tabs
  tabProtocols: 'earn-tab-protocols',
  tabPortfolio: 'earn-tab-portfolio',
  tabAvailableAssets: 'earn-tab-available-assets',

  // Protocol list
  protocolItem: (name: string) => `earn-protocol-${name}`,
  protocolStakeButton: (name: string) => `earn-protocol-stake-${name}`,

  // Portfolio
  portfolioOverview: 'earn-portfolio-overview',
  portfolioItem: (name: string) => `earn-portfolio-item-${name}`,

  // Available assets
  assetItem: (symbol: string) => `earn-asset-${symbol}`,
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
  networkFilterCheckbox: (id: string) => `earn-network-filter-checkbox-${id}`,
} as const;
