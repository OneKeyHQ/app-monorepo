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
  MessageConfirmDetails: 'sig-confirm-msg-details',

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
} as const;
