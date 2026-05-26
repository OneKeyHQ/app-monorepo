export const SendTestIDs = {
  // Send data input
  dataInputPage: 'send-recipient-amount-form', // preserve existing
  recipientInput: 'send-recipient-input',
  amountInput: 'send-amount-input',
  memoInput: 'send-memo-input',
  maxButton: 'send-max-button',
  tokenSelector: 'send-token-selector',
  networkSelector: 'send-network-selector',

  // Address helpers
  addressBookButton: 'send-address-book-button',
  scanQRButton: 'send-scan-qr-button',
  pasteButton: 'send-paste-button',

  // Send confirm
  confirmPage: 'tx-confirmation-body', // preserve existing (shared with SignatureConfirm)
  confirmButton: 'send-confirm-button',
  cancelButton: 'send-cancel-button',

  // Fee
  feeContainer: 'send-fee-container',
  feeSelector: 'send-fee-selector',
  feeOption: (level: string) => `send-fee-option-${level}`,

  // Advanced
  advancedSettings: 'send-advanced-settings',

  // Replace tx
  replaceTxPage: 'replace-tx-modal', // preserve existing

  // Coin control
  coinControlPage: 'send-coin-control-page',
  coinControlSortSelect: 'send-coin-control-sort-select',
  coinControlSelectAllCheckbox: 'send-coin-control-select-all-checkbox',
  coinControlDoneButton: 'send-coin-control-done-button',

  // Amount input extras
  nftMaxButton: 'send-nft-max-button',
  hexDataFaqButton: 'send-hex-data-faq-button',
  hexDataInput: 'send-hex-data-input',
  buyTokenButton: 'send-buy-token-button',
  insufficientFundsButton: 'send-insufficient-funds-button',

  // Data input (recipient/amount form)
  memoTextarea: 'send-memo-textarea',
  paymentIdTextarea: 'send-payment-id-textarea',
  noteTextarea: 'send-note-textarea',

  // Recipient quick select
  recipientQuickSelectWalletToggle: 'send-recipient-quick-wallet-toggle',
  recipientQuickSelectNetworkTrigger: 'send-recipient-quick-network-trigger',

  // Fee editor custom inputs (one per Form.Field name, derived per fee shape)
  feeDotExtraTipInput: 'send-fee-dot-extra-tip-input',
  feeMaxBaseFeeInput: 'send-fee-max-base-fee-input',
  feePriorityFeeInput: 'send-fee-priority-fee-input',
  feeGasLimitInput: 'send-fee-gas-limit-input',
  feeGasSuiPriceInput: 'send-fee-gas-sui-price-input',
  feeGasSuiBudgetInput: 'send-fee-gas-sui-budget-input',
  feeGasPriceInput: 'send-fee-gas-price-input',
  feeRateUtxoInput: 'send-fee-rate-utxo-input',
  feeRateCkbInput: 'send-fee-rate-ckb-input',
  feeComputeUnitPriceInput: 'send-fee-compute-unit-price-input',
} as const;
