export const OnboardingTestIDs = {
  // GetStarted page
  getStartedPage: 'onboarding-get-started-page',
  createWalletButton: 'onboarding-create-wallet-button',
  importWalletButton: 'onboarding-import-wallet-button',
  connectHardwareButton: 'onboarding-connect-hardware-button',
  googleSignInButton: 'onboarding-google-sign-in-button',
  appleSignInButton: 'onboarding-apple-sign-in-button',
  termsAndPrivacy: 'onboarding-terms-and-privacy',

  // Password / Passcode setup
  createPasscodePage: 'onboarding-create-passcode-page',
  passcodeInput: 'onboarding-passcode-input',
  confirmPasscodeInput: 'onboarding-confirm-passcode-input',
  confirmPinPage: 'onboarding-confirm-pin-page',

  // Import wallet
  importPhrasePage: 'onboarding-import-phrase-page',
  phraseInput: (index: number) => `phrase-input-index${index}`, // preserve existing
  phraseLengthSelector: 'phrase-length', // preserve existing
  clearAllButton: 'clear-all', // preserve existing
  phraseSuggestion: (word: string) => `suggest-${word}`, // preserve existing

  // Private key network selection
  selectPrivateKeyNetworkPage: 'onboarding-select-private-key-network-page',
  derivationPathSelector: 'wallet-derivation-path-selector-trigger', // preserve existing

  // Recovery phrase display
  showRecoveryPhrasePage: 'onboarding-show-recovery-phrase-page',
  copyRecoveryPhraseConfirm: 'copy-recovery-phrase-confirm', // preserve existing
  copyRecoveryPhraseCancel: 'copy-recovery-phrase-cancel', // preserve existing

  // Verify recovery phrase
  verifyRecoveryPhrasePage: 'onboarding-verify-recovery-phrase-page',

  // Finalize wallet setup
  finalizeSetupPage: 'onboarding-finalize-setup-page',

  // Add existing wallet
  addExistingWalletPage: 'onboarding-add-existing-wallet-page',

  // Watch account
  importWatchedAccountPage: 'onboarding-import-watched-account-page',
  watchAddressInput: 'onboarding-watch-address-input',

  // iCloud backup list
  iCloudBackupPage: 'onboarding-icloud-backup-page',
  iCloudBackupViewOlderBackupsBtn:
    'onboarding-icloud-backup-view-older-backups-btn',
  iCloudBackupDevMockEmptyBtn: 'onboarding-icloud-backup-dev-mock-empty-btn',
  iCloudBackupDevClearPasswordBtn:
    'onboarding-icloud-backup-dev-clear-password-btn',
  iCloudBackupDevIsPasswordSetBtn:
    'onboarding-icloud-backup-dev-is-password-set-btn',
  iCloudBackupDevVerifyPasswordBtn:
    'onboarding-icloud-backup-dev-verify-password-btn',
  iCloudBackupDevSetPasswordBtn:
    'onboarding-icloud-backup-dev-set-password-btn',
  iCloudBackupDevGetAllBackupsBtn:
    'onboarding-icloud-backup-dev-get-all-backups-btn',
  iCloudBackupDevIOSQueryAllRecordsBtn:
    'onboarding-icloud-backup-dev-ios-query-all-records-btn',
  iCloudBackupDevAndroidListAllFilesBtn:
    'onboarding-icloud-backup-dev-android-list-all-files-btn',
  iCloudBackupDevAndroidGetManifestBtn:
    'onboarding-icloud-backup-dev-android-get-manifest-btn',
  iCloudBackupDevAndroidGetLegacyMetaDataBtn:
    'onboarding-icloud-backup-dev-android-get-legacy-meta-data-btn',
  iCloudBackupDevAndroidGetManifestFileObjectBtn:
    'onboarding-icloud-backup-dev-android-get-manifest-file-object-btn',
  iCloudBackupDevAndroidRemoveManifestFileBtn:
    'onboarding-icloud-backup-dev-android-remove-manifest-file-btn',
  iCloudBackupDevBackupNowToDetailBtn:
    'onboarding-icloud-backup-dev-backup-now-to-detail-btn',
  iCloudBackupDevBackupNowBtn: 'onboarding-icloud-backup-dev-backup-now-btn',
  iCloudBackupDevGetCloudAccountInfoBtn:
    'onboarding-icloud-backup-dev-get-cloud-account-info-btn',
  iCloudBackupDevRemoveAllBackupsBtn:
    'onboarding-icloud-backup-dev-remove-all-backups-btn',
  iCloudBackupDevOpenLegacyBackupsBtn:
    'onboarding-icloud-backup-dev-open-legacy-backups-btn',

  // iCloud backup details
  iCloudBackupDetailsPage: 'onboarding-icloud-backup-details-page',
  iCloudBackupDetailsBackupNowBtn:
    'onboarding-icloud-backup-details-backup-now-btn',
  iCloudBackupDetailsSettingsBtn:
    'onboarding-icloud-backup-details-settings-btn',
  iCloudBackupDetailsImportBtn: 'onboarding-icloud-backup-details-import-btn',
  iCloudBackupDetailsDeleteBtn: 'onboarding-icloud-backup-details-delete-btn',
  iCloudBackupDetailsDevShowBackupDataBtn:
    'onboarding-icloud-backup-details-dev-show-backup-data-btn',
  iCloudBackupDetailsDevShowPrivateDataBtn:
    'onboarding-icloud-backup-details-dev-show-private-data-btn',
  iCloudBackupDetailsDevMockEmptyWalletsBtn:
    'onboarding-icloud-backup-details-dev-mock-empty-wallets-btn',
  iCloudBackupDetailsDevBackup30Btn:
    'onboarding-icloud-backup-details-dev-backup-30-btn',

  // Finalize wallet setup actions
  finalizeSetupEnterWalletBtn: 'onboarding-finalize-setup-enter-wallet-btn',
  finalizeSetupRetryBtn: 'onboarding-finalize-setup-retry-btn',
  finalizeSetupExitBtn: 'onboarding-finalize-setup-exit-btn',

  // GetStarted action buttons (md layout)
  getStartedActionBtn: (key: string) =>
    `onboarding-get-started-action-${key}-btn`,

  // CreateNewWallet
  createNewWalletSeedPhraseBtn: 'onboarding-create-new-wallet-seed-phrase-btn',

  // CreateOrImportWallet primary option button
  createOrImportWalletOptionBtn: (key: string) =>
    `onboarding-create-or-import-wallet-option-${key}-btn`,

  // Connect QR code
  connectQRCodePage: 'onboarding-connect-qr-code-page',
  connectQRCodeScanBtn: 'onboarding-connect-qr-code-scan-btn',

  // Connect your device
  connectYourDeviceTroubleshootingBtn:
    'onboarding-connect-your-device-troubleshooting-btn',
  connectYourDeviceContactUsBtn:
    'onboarding-connect-your-device-contact-us-btn',
  connectYourDeviceBluetoothConnectBtn:
    'onboarding-connect-your-device-bluetooth-connect-btn',
  connectYourDeviceUSBConnectBtn:
    'onboarding-connect-your-device-usb-connect-btn',
  connectYourDeviceCreateQRWalletBtn:
    'onboarding-connect-your-device-create-qr-wallet-btn',
  connectYourDeviceAdvancedMenuBtn:
    'onboarding-connect-your-device-advanced-menu-btn',

  // Connection flow (Ledger / third party)
  connectionFlowLedgerStartBtn: 'onboarding-connection-flow-ledger-start-btn',

  // Import phrase / private key
  importPhraseConfirmBtn: 'onboarding-import-phrase-confirm-btn',

  // Select private key network
  selectPrivateKeyNetworkAccountNameInput:
    'onboarding-select-private-key-network-account-name-input',
  selectPrivateKeyNetworkSubmitBtn:
    'onboarding-select-private-key-network-submit-btn',

  // Onboarding layout (shared across pages)
  layoutHeaderBackBtn: 'onboarding-layout-header-back-btn',
  layoutHeaderLanguageSelector: 'onboarding-layout-header-language-selector',
  layoutHeaderLanguageBtn: 'onboarding-layout-header-language-btn',
  layoutHeaderLanguageIconBtn: 'onboarding-layout-header-language-icon-btn',

  // Pin pages
  newPinCreatedCloseBtn: 'onboarding-new-pin-created-close-btn',
  resetPinGuideDoneBtn: 'onboarding-reset-pin-guide-done-btn',

  // Check and update
  checkAndUpdatePage: 'onboarding-check-and-update-page',
  checkAndUpdateVerifyBtn: 'onboarding-check-and-update-verify-btn',
  checkAndUpdateDoneBtn: 'onboarding-check-and-update-done-btn',
  checkAndUpdateUpdateBtn: 'onboarding-check-and-update-update-btn',
  checkAndUpdateSkipUpdateBtn: 'onboarding-check-and-update-skip-update-btn',
  checkAndUpdateRetryBtn: 'onboarding-check-and-update-retry-btn',
  checkAndUpdateSkipStepBtn: 'onboarding-check-and-update-skip-step-btn',
} as const;
