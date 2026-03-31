export const HomeTestIDs = {
  // Page
  page: 'home-page',

  // Header
  headerContainer: 'Wallet-Tab-Header', // preserve existing
  headerAccountSelector: 'home-header-account-selector',
  headerNetworkSelector: 'home-header-network-selector',
  headerScanButton: 'home-header-scan-button',
  headerSearchButton: 'home-header-search-button',

  // Tabs
  tabPortfolio: 'home-tab-portfolio',
  tabDefi: 'home-tab-defi',
  tabNFT: 'home-tab-nft',
  tabHistory: 'home-tab-history',

  // Wallet actions
  sendButton: 'home-send-button',
  receiveButton: 'home-receive-button',
  swapButton: 'home-swap-button',
  buyButton: 'home-buy-button',
  stakingButton: 'home-staking-button',
  moreButton: 'home-more-button',

  // Wallet overview
  walletOverview: 'home-wallet-overview',
  totalBalance: 'home-total-balance',

  // Token list
  tokenListItem: (symbol: string) => `home-token-item-${symbol}`,

  // Risk approval
  riskApprovalAlert: 'home-risk-approval-alert',
  approvalListEmpty: 'Wallet-Approval-Unsupported-Empty', // preserve existing
} as const;
