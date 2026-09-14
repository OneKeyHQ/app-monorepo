export const SettingTestIDs = {
  // Main settings
  settingsPage: 'setting-page',

  // Settings items
  eraseDataButton: 'setting-erase-data', // preserve existing
  versionItem: 'setting-version', // preserve existing
  currencyItem: 'setting-currency',
  languageItem: 'setting-language',
  themeItem: 'setting-theme',
  notificationsItem: 'setting-notifications',
  securityItem: 'setting-security',
  clearAppCacheItem: 'setting-clear-app-cache',
  addressBookItem: 'setting-address-book',
  aboutItem: 'setting-about',
  devModeItem: 'setting-dev-mode',
  officialChannelsItem: 'setting-official-channels',
  travelModeItem: 'setting-travel-mode-item',
  travelModeSwitch: 'setting-travel-mode-switch',
  travelModeRestartButton: 'setting-travel-mode-restart-button',

  // Clear application cache
  clearAppCachePage: 'setting-clear-app-cache-page',
  clearAppCacheOneKeyIdCheckbox: 'setting-clear-app-cache-onekey-id-checkbox',

  // OneKey ID
  oneKeyIdPage: 'setting-onekey-id-page',
  oneKeyIdSignIn: 'setting-onekey-id-sign-in',
  oneKeyIdSettings: 'setting-onekey-id-settings',
  oneKeyIdSignInSecurity: 'setting-onekey-id-sign-in-security',
  oneKeyIdPersonalInfo: 'setting-onekey-id-personal-info',

  // Custom RPC
  customRpcPage: 'setting-custom-rpc-page',
  customRpcItem: 'CustomRpcItemContainer', // preserve existing
  customRpcAddButton: 'setting-custom-rpc-add-button',

  // Signature record
  signatureRecordPage: 'setting-signature-record-page',
  signatureTransactions: 'setting-signature-transactions',
  signatureSignText: 'setting-signature-sign-text',
  signatureConnectedSites: 'setting-signature-connected-sites',

  // Dev settings (existing IDs preserved)
  devOnlyPassword: 'dev-only-password', // preserve existing
  eraseDataInput: 'erase-data-input', // preserve existing
  eraseDataConfirm: 'erase-data-confirm', // preserve existing
  confirmButton: 'confirm-button', // preserve existing
  localSecretEnvelopeSelfTestButton:
    'setting-local-secret-envelope-self-test-button',
  localSecretEnvelopeSelfTestConfirm:
    'setting-local-secret-envelope-self-test-confirm',
  localSecretEnvelopeRestoreSelfTestButton:
    'setting-local-secret-envelope-restore-self-test-button',
  localSecretEnvelopeRestoreSelfTestConfirm:
    'setting-local-secret-envelope-restore-self-test-confirm',
  localSecretEnvelopeMigrationDiagnosticButton:
    'setting-local-secret-envelope-migration-diagnostic-button',
  localSecretEnvelopeMigrationDiagnosticConfirm:
    'setting-local-secret-envelope-migration-diagnostic-confirm',
  localSecretEnvelopeSimulateKeyLossButton:
    'setting-local-secret-envelope-simulate-key-loss-button',
  localSecretEnvelopeSimulateKeyLossConfirm:
    'setting-local-secret-envelope-simulate-key-loss-confirm',
  localSecretEnvelopeSelfTestCopyRaw:
    'setting-local-secret-envelope-self-test-copy-raw',

  // Tab custom elements (desktop tab settings)
  tabMenuBarTraySwitch: 'setting-tab-menu-bar-tray-switch',
  tabUseGasAccountByDefaultSwitch:
    'setting-tab-use-gas-account-by-default-switch',
  tabSplitViewSwitch: 'setting-tab-split-view-switch',
  tabHapticFeedbackSwitch: 'setting-tab-haptic-feedback-switch',

  // Dev split bundle test page
  devSplitBundleRefreshBtn: 'setting-dev-split-bundle-refresh-btn',
  devSplitBundleRunTestsBtn: 'setting-dev-split-bundle-run-tests-btn',
  devSplitBundleConcurrentBtn: 'setting-dev-split-bundle-concurrent-btn',

  // API endpoint dialog form
  apiEndpointNameInput: 'setting-api-endpoint-name-input',
  apiEndpointUrlInput: 'setting-api-endpoint-url-input',
  apiEndpointServiceModuleSelect: 'setting-api-endpoint-service-module-select',
  apiEndpointEnabledSwitch: 'setting-api-endpoint-enabled-switch',
  apiEndpointCancelButton: 'setting-api-endpoint-cancel-btn',
  apiEndpointSaveButton: 'setting-api-endpoint-save-btn',

  // Social button group (SocialButtonGroup)
  socialOnekeyWebsiteBtn: 'setting-social-onekey-website-btn',
  socialXBtn: 'setting-social-x-btn',
  socialGithubBtn: 'setting-social-github-btn',
  socialRedditBtn: 'setting-social-reddit-btn',
  socialInstagramBtn: 'setting-social-instagram-btn',
  socialSupportBtn: 'setting-social-support-btn',
} as const;

/**
 * Sidebar tabs derived from a `desktopTab` item reuse the item's testID with
 * this suffix so the tab and the still-rendered item row (e.g. a search
 * result) never collide in one tree.
 */
export function settingsSidebarTabTestID(itemTestID: string): string {
  return `${itemTestID}-tab`;
}
