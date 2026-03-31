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

  // iCloud backup
  iCloudBackupDetailsPage: 'onboarding-icloud-backup-details-page',

  // Keyless wallet
  keylessWalletCreationPage: 'onboarding-keyless-wallet-creation-page',
  keylessWalletRecoveryPage: 'onboarding-keyless-wallet-recovery-page',

  // Connect QR code
  connectQRCodePage: 'onboarding-connect-qr-code-page',

  // Check and update
  checkAndUpdatePage: 'onboarding-check-and-update-page',
} as const;
