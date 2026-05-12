export const SignatureConfirmTestIDs = {
  // -- TxConfirm page --
  TxConfirmPage: 'sig-confirm-tx-page',
  TxConfirmBody: 'tx-confirmation-body', // preserving existing hardcoded value
  TxConfirmHeaderRight: 'sig-confirm-tx-header-right',
  TxConfirmLoading: 'sig-confirm-loading',

  // -- TxConfirm actions --
  TxConfirmFooter: 'sig-confirm-tx-footer',
  TxConfirmActions: 'sig-confirm-tx-actions',
  TxConfirmRiskCheckbox: 'sig-confirm-tx-risk-checkbox',

  // -- MessageConfirm page --
  MessageConfirmPage: 'sig-confirm-msg-page',
  MessageConfirmBody: 'sig-confirm-msg-body',

  // -- MessageConfirm actions --
  MessageConfirmFooter: 'sig-confirm-msg-footer',
  MessageConfirmActions: 'sig-confirm-msg-actions',
  MessageConfirmRiskCheckbox: 'sig-confirm-msg-risk-checkbox',
  MessageConfirmReferralCheckbox: 'sig-confirm-msg-referral-checkbox',

  // -- MessageConfirmFromDapp loading --
  MessageConfirmFromDappPage: 'sig-confirm-msg-dapp-page',
  MessageConfirmFromDappLoading: 'sig-confirm-msg-dapp-loading',

  // -- Transaction details --
  TxConfirmDetails: 'sig-confirm-tx-details',

  // -- Fee info --
  TxFeeInfo: 'sig-confirm-fee-info',
  TxFeeSelectorTrigger: 'sig-confirm-fee-selector-trigger',

  // -- Advanced settings --
  TxAdvancedSettings: 'sig-confirm-tx-advanced',
  MessageAdvancedSettings: 'sig-confirm-msg-advanced',
  AdvancedSettingsAccordion: 'sig-confirm-advanced-accordion',
  NonceInput: 'sig-confirm-nonce-input',

  // -- Data viewer --
  DataViewerTab: 'sig-confirm-data-viewer-tab',
  DataViewerCopy: 'sig-confirm-data-viewer-copy',
  MessageDataViewer: 'sig-confirm-msg-data-viewer',

  // -- Approve editor --
  ApproveEditorAllowanceInput: 'sig-confirm-approve-allowance-input',
  ApproveEditorUnlimitedSwitch: 'sig-confirm-approve-unlimited-switch',
  ApproveEditorBalanceButton: 'sig-confirm-approve-balance-btn',

  // -- Swap info --
  SwapInfo: 'swap-info', // preserving existing hardcoded value

  // -- Staking info --
  StakingInfo: 'staking-info', // preserving existing hardcoded value

  // -- DApp connection info --
  DAppSiteMark: 'sig-confirm-dapp-site-mark',

  // -- Alerts --
  TxConfirmAlert: 'sig-confirm-tx-alert',
  MessageConfirmAlert: 'sig-confirm-msg-alert',

  // -- Similar address dialog --
  SimilarAddressDialog: 'sig-confirm-similar-address-dialog',
  SimilarAddressRiskCheckbox: 'sig-confirm-similar-address-risk-checkbox',
  SimilarAddressConfirmButton: 'sig-confirm-similar-address-confirm-btn',
  SimilarAddressCancelButton: 'sig-confirm-similar-address-cancel-btn',

  // -- Task queue controller --
  TaskQueueController: 'sig-confirm-task-queue',
  TaskQueuePrevButton: 'sig-confirm-task-queue-prev-btn',
  TaskQueueNextButton: 'sig-confirm-task-queue-next-btn',
  TaskQueueLabel: 'sig-confirm-task-queue-label',

  // -- Sponsored fees dialog --
  TxFeeSponsoredGotItButton: 'sig-confirm-fee-sponsored-got-it-btn',

  // -- Fee editor custom inputs (one per Form.Field name, per fee shape) --
  FeeDotExtraTipInput: 'sig-confirm-fee-dot-extra-tip-input',
  FeeMaxBaseFeeInput: 'sig-confirm-fee-max-base-fee-input',
  FeePriorityFeeInput: 'sig-confirm-fee-priority-fee-input',
  FeeGasEIP1559LimitInput: 'sig-confirm-fee-gas-eip1559-limit-input',
  FeeGasSuiPriceInput: 'sig-confirm-fee-gas-sui-price-input',
  FeeGasSuiBudgetInput: 'sig-confirm-fee-gas-sui-budget-input',
  FeeGasPriceInput: 'sig-confirm-fee-gas-price-input',
  FeeGasLimitLegacyInput: 'sig-confirm-fee-gas-limit-legacy-input',
  FeeRateUtxoInput: 'sig-confirm-fee-rate-utxo-input',
  FeeRateCkbInput: 'sig-confirm-fee-rate-ckb-input',
  FeeComputeUnitPriceInput: 'sig-confirm-fee-compute-unit-price-input',
  FeeNeoN3PriorityFeeInput: 'sig-confirm-fee-neo-n3-priority-fee-input',
  FeeNeoN3NetworkFeeInput: 'sig-confirm-fee-neo-n3-network-fee-input',
  FeeNeoN3SystemFeeInput: 'sig-confirm-fee-neo-n3-system-fee-input',
} as const;
