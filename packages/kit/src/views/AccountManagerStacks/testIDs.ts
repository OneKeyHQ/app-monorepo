export const AccountManagerTestIDs = {
  // Wallet list
  walletList: 'account-selector-wallet-list', // preserve existing
  addWalletButton: 'add-wallet', // preserve existing

  // Wallet details
  accountList: 'account-selector-accountList', // preserve existing
  accountSelectorHeader: 'account-selector-header', // preserve existing
  searchBarAddButton: 'account-search-bar-add-button', // preserve existing
  addAccountButton: 'add-account-button', // preserve existing

  // Account items
  accountItem: (index: number) => `account-item-index-${index}`, // preserve existing
  accountAddAccount: 'account-add-account', // preserve existing
  accountAddressValue: 'account-item-value-address-splitter', // preserve existing

  // Wallet edit
  walletEditButton: (name: string) => `wallet-item-edit-button-${name}`, // preserve existing
  walletBackupButton: 'AccountSelector-WalletOption-Backup', // preserve existing
  walletBoundReferralCode: 'wallet-bound-referral-code-button', // preserve existing
  batchCreateAccountButton: 'batch-create-account-button-trigger', // preserve existing

  // Account edit
  accountEditButton: (name: string) => `account-item-edit-button-${name}`, // preserve existing
  exportPrivateKey: (name: string) => `popover-export-private-key-${name}`, // preserve existing
  exportPublicKey: (name: string) => `popover-export-public-key-${name}`, // preserve existing
  exportMnemonicKey: (name: string) => `popover-export-mnemonic-key-${name}`, // preserve existing

  // Wallet rename
  walletRenameInput: 'account-manager-wallet-rename-input',
  walletRenameConfirm: 'account-manager-wallet-rename-confirm',

  // Account rename
  accountRenameInput: 'account-manager-account-rename-input',
  accountRenameConfirm: 'account-manager-account-rename-confirm',

  // Account remove
  accountRemoveButton: 'account-manager-account-remove-button',
  accountRemoveConfirm: 'account-manager-account-remove-confirm',

  // Wallet remove
  walletRemoveButton: 'account-manager-wallet-remove-button',
  walletRemoveConfirm: 'account-manager-wallet-remove-confirm',

  // Bot wallet manager
  botWalletVisibilityToggleBtn: 'bot-wallet-manager-visibility-toggle-btn',
  botWalletExportMnemonicBtn: 'bot-wallet-manager-export-mnemonic-btn',
  botWalletExportToCliBtn: 'bot-wallet-manager-export-to-cli-btn',
  botWalletDeactivateBtn: 'bot-wallet-manager-deactivate-btn',
  botWalletReactivateBtn: 'bot-wallet-manager-reactivate-btn',
  botWalletCreateNameInput: 'bot-wallet-manager-create-name-input',
  botWalletRefreshBtn: 'bot-wallet-manager-refresh-btn',
  botWalletCreateBtn: 'bot-wallet-manager-create-btn',
} as const;
