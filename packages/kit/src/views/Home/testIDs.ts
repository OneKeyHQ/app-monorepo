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
  tokenItemTestIDPrefix: 'home-token-item',
  tokenListItem: (networkId: string, symbol: string) =>
    `home-token-item-${networkId}-${symbol}`,

  // Risk approval
  riskApprovalAlert: 'home-risk-approval-alert',
  approvalListEmpty: 'Wallet-Approval-Unsupported-Empty', // preserve existing

  // Referral web landing steps
  referralLandingDownloadBtn: 'home-referral-landing-download-btn',
  referralLandingDownloadHintBtn: 'home-referral-landing-download-hint-btn',
  referralLandingBindBtn: 'home-referral-landing-bind-btn',
  referralLandingTradeBtn: 'home-referral-landing-trade-btn',

  // Zero-gas continue confirmation
  walletActionsZeroGasContinueBtn: 'home-wallet-actions-zero-gas-continue-btn',

  // Popular trading token list
  popularTokenStarBtnMobile: (symbol: string) =>
    `home-popular-token-star-mobile-${symbol}`,
  popularTokenStarBtnDesktop: (symbol: string) =>
    `home-popular-token-star-desktop-${symbol}`,
  popularViewMoreBtn: 'home-popular-view-more-btn',

  // DeFi protocol chip strip
  defiProtocolChipScrollBtn: (direction: 'left' | 'right') =>
    `home-defi-protocol-chip-scroll-${direction}-btn`,
} as const;
