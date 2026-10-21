// Digits of the Keyless wallet recovery PIN, kept apart from the App unlock
// passcode length so the two concepts never drift into each other.
export const KEYLESS_PIN_LENGTH = 4;

export enum EKeylessWalletEnableScene {
  Onboarding = 'onboarding',
  GetMnemonic = 'getMnemonic',
}
export enum EKeylessFinalizeAction {
  Create = 'create',
  Restore = 'restore',
  ResetPin = 'resetPin',
}
