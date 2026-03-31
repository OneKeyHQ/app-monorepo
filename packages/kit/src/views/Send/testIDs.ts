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
  confirmPage: 'tx-confirmation-body', // preserve existing
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
} as const;
