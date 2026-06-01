export const SwapTestIDs = {
  // Page
  pageContainer: 'swap-content-container', // preserve existing

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
  kLineModal: 'swap-kline-modal',
  settingsButton: 'swap-settings-button',

  // Slippage
  slippageSelector: 'swap-slippage-selector',
  slippageOption: (value: string) => `swap-slippage-${value}`,
  slippageCustomInput: 'swap-slippage-custom-input',

  // Provider
  providerSelector: 'swap-provider-selector',
  providerItem: (name: string) => `swap-provider-${name}`,

  // Pro
  proContainer: 'swap-pro-container',
  proPositionListHeader: 'Swap-Pro-Position-List-Header', // preserve existing
  proBuySellGroup: 'swap-pro-buy-sell-group',
  proSearchTokenList: 'swap-pro-search-token-list',

  // Limit order
  limitPriceInput: 'swap-limit-price-input',
  limitOrderItem: (index: number) => `swap-limit-order-${index}`,

  // History
  pendingHistoryList: 'swap-pending-history-list',

  // Incognito / recipient
  incognitoModeSwitch: 'swap-incognito-mode-switch',
  incognitoRecipientPickerButton: 'swap-incognito-recipient-picker-button',

  // Action footer
  actionPrimaryButton: 'swap-action-primary-button',
} as const;
