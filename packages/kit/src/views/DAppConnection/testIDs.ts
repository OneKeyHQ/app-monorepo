export const DAppConnectionTestIDs = {
  // Connection Modal (approval page)
  ConnectionModal: 'dapp-connection-modal',
  ConnectionApproveButton: 'dapp-connection-approve-btn',
  ConnectionRejectButton: 'dapp-connection-reject-btn',
  ConnectionAccountSelector: 'dapp-connection-account-selector',
  ConnectionPermissions: 'dapp-connection-permissions',
  ConnectionDappList: 'dapp-connection-dapp-list',

  // Sign Message Modal
  SignMessageModal: 'dapp-connection-sign-message-modal',
  SignMessageConfirmButton: 'dapp-connection-sign-confirm-btn',
  SignMessageRejectButton: 'dapp-connection-sign-reject-btn',
  SignMessageContent: 'dapp-connection-sign-message-content',
  SignMessageToggleRaw: 'dapp-connection-sign-toggle-raw-btn',

  // Request Layout (shared)
  RequestLayout: 'dapp-connection-request-layout',
  RequestTitle: 'dapp-connection-request-title',
  RequestSubtitle: 'dapp-connection-request-subtitle',
  SiteMark: 'dapp-connection-site-mark',
  RiskyAlert: 'dapp-connection-risky-alert',
  ContinueOperateCheckbox: 'dapp-connection-continue-operate-checkbox',

  // Connected Sites List
  ConnectionList: 'dapp-connection-list',
  ConnectionListRemoveAllButton: 'dapp-connection-list-remove-all-btn',
  ConnectionListItem: 'dapp-connection-list-item',
  ConnectionListDisconnectButton: 'dapp-connection-list-disconnect-btn',

  // Current Connection Modal (extension panel)
  CurrentConnectionModal: 'dapp-connection-current-modal',
  CurrentConnectionDappInfo: 'dapp-connection-current-dapp-info',
  CurrentConnectionManageButton: 'dapp-connection-current-manage-btn',
  CurrentConnectionAlignAccountButton:
    'dapp-connection-current-align-account-btn',
  CurrentConnectionDefaultWalletButton:
    'dapp-connection-current-default-wallet-btn',
  CurrentConnectionDisconnectButton: 'dapp-connection-current-disconnect-btn',

  // WalletConnect Session Proposal
  WCSessionProposalModal: 'dapp-connection-wc-proposal-modal',
  WCSessionApproveButton: 'dapp-connection-wc-approve-btn',
  WCSessionRejectButton: 'dapp-connection-wc-reject-btn',

  // Nostr Sign Event Modal
  NostrSignModal: 'dapp-connection-nostr-sign-modal',
  NostrSignConfirmButton: 'dapp-connection-nostr-confirm-btn',
  NostrSignRejectButton: 'dapp-connection-nostr-reject-btn',
  NostrSignContent: 'dapp-connection-nostr-sign-content',
  NostrSignViewDetailsButton: 'dapp-connection-nostr-view-details-btn',
  NostrSignAutoSignCheckbox: 'dapp-connection-nostr-auto-sign-checkbox',

  // Cosmos Enigma Unlock Modal
  CosmosEnigmaModal: 'dapp-connection-cosmos-enigma-modal',
  CosmosEnigmaConfirmButton: 'dapp-connection-cosmos-confirm-btn',
  CosmosEnigmaRejectButton: 'dapp-connection-cosmos-reject-btn',

  // Risk Whitelist Modal
  RiskWhiteListModal: 'dapp-connection-risk-whitelist-modal',
  RiskWhiteListConfirmButton: 'dapp-connection-risk-whitelist-confirm-btn',
  RiskWhiteListRejectButton: 'dapp-connection-risk-whitelist-reject-btn',

  // Default Wallet Settings
  DefaultWalletSettingsModal: 'dapp-connection-default-wallet-modal',
  DefaultWalletToggle: 'dapp-connection-default-wallet-toggle',

  // Extension Floating Trigger
  ExtFloatingTrigger: 'dapp-connection-ext-floating-trigger',
  ExtFloatingDisconnectButton: 'dapp-connection-ext-floating-disconnect-btn',
  ExtFloatingSwitchConfirm: 'dapp-connection-ext-floating-switch-confirm-btn',
  ExtFloatingSwitchCancel: 'dapp-connection-ext-floating-switch-cancel-btn',

  // Account List Items
  AccountListStandAlone: 'DAppAccountListStandAloneItem', // preserve existing
  AccountListItem: 'dapp-connection-account-list-item',
  NetworkSelector: 'dapp-connection-network-selector',
  AccountSelector: 'dapp-connection-account-selector-trigger',

  // Derive context hash modal
  DeriveContextHashContextTextArea:
    'dapp-connection-derive-context-hash-context-textarea',
} as const;
