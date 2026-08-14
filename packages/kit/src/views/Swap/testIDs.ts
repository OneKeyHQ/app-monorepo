export const SwapTestIDs = {
  // Page
  pageContainer: 'swap-content-container', // preserve existing
  typeTab: (type: string) => `swap-type-tab-${type}`,

  // Token selection
  fromTokenSelector: 'swap-from-token-selector',
  toTokenSelector: 'swap-to-token-selector',
  switchTokensButton: 'swap-switch-tokens-button',

  // Amount
  fromAmountInput: 'swap-from-amount-input',
  toAmountInput: 'swap-to-amount-input',
  maxButton: 'swap-max-button',

  // Actions
  swapButton: 'swap-action-button',
  approveButton: 'swap-approve-button',
  kLineButton: 'swap-kline-button',
  kLineChart: 'swap-kline-chart',
  kLineModal: 'swap-kline-modal',
  settingsButton: 'swap-settings-button',
  inviteeRewardButton: 'swap-invitee-reward-button',
  inviteeRewardSettingsItem: 'swap-invitee-reward-settings-item',

  // Slippage
  slippageSelector: 'swap-slippage-selector',
  slippageOption: (value: string) => `swap-slippage-${value}`,
  slippageCustomInput: 'swap-slippage-custom-input',

  // Provider
  providerSelector: 'swap-provider-selector',
  quoteDetailsToggle: 'swap-quote-details-toggle',
  providerItem: (name: string) => `swap-provider-${name}`,
  tipsContainer: 'swap-tips-container',

  // Pro
  proContainer: 'swap-pro-container',
  proTokenSelector: 'swap-pro-token-selector',
  proPrice: 'swap-pro-price',
  proTransactionList: 'swap-pro-transaction-list',
  proPositionListHeader: 'Swap-Pro-Position-List-Header', // preserve existing
  proBuySellGroup: 'swap-pro-buy-sell-group',
  proSearchTokenList: 'swap-pro-search-token-list',

  // Stock
  stockBuyTab: 'swap-stock-buy-tab',
  stockSellTab: 'swap-stock-sell-tab',
  stockAmountInputSkeleton: 'swap-stock-amount-input-skeleton',
  stockEstimatedReceive: 'swap-stock-estimated-receive',
  stockMobileContainer: 'swap-stock-mobile-container',
  stockMarketTokenHeader: 'swap-stock-market-token-header',
  stockMarketPanel: 'swap-stock-market-panel',
  stockMarketDataGrid: 'swap-stock-market-data-grid',
  stockTokenDetails: 'swap-stock-token-details',
  stockTokenIssuerOpen: 'swap-stock-token-issuer-open',
  stockTokenContractCopy: 'swap-stock-token-contract-copy',
  stockTokenContractOpen: 'swap-stock-token-contract-open',
  stockTokenRatioInfo: 'swap-stock-token-ratio-info',
  stockTokenRatioDialog: 'swap-stock-token-ratio-dialog',
  stockTokenRatioDialogClose: 'swap-stock-token-ratio-dialog-close',
  stockTokenDetailsLoading: 'swap-stock-token-details-loading',
  stockChartLoading: 'swap-stock-chart-loading',
  stockChartContent: 'swap-stock-chart-content',
  stockChartEmpty: 'swap-stock-chart-empty',
  stockChartError: 'swap-stock-chart-error',
  stockChartRetry: 'swap-stock-chart-retry',
  stockTradeStatusAlert: 'swap-stock-trade-status-alert',

  // Limit order
  limitPriceInput: 'swap-limit-price-input',
  limitOrderItem: (index: number) => `swap-limit-order-${index}`,

  // History
  historyButton: 'swap-history-button',
  pendingHistoryList: 'swap-pending-history-list',

  // Incognito / recipient
  incognitoModeSwitch: 'swap-incognito-mode-switch',
  incognitoRecipientPickerButton: 'swap-incognito-recipient-picker-button',

  // Action footer
  actionPrimaryButton: 'swap-action-primary-button',
} as const;
