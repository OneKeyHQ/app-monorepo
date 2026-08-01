import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

export type IHardwareWalletCreationMode = 'standard' | 'hidden';

export function shouldCheckExistingStandardWallet(
  state: IOneKeyDeviceState,
): boolean {
  return (
    state.status.unlocked === true && state.status.unlockedAttachPin !== true
  );
}

export function resolveAutomaticWalletCreationMode({
  state,
  existsStandardWallet,
}: {
  state: IOneKeyDeviceState;
  existsStandardWallet: boolean;
}): IHardwareWalletCreationMode | undefined {
  const { passphraseProtection, unlocked, unlockedAttachPin } = state.status;

  if (unlocked !== true) {
    return 'standard';
  }

  if (unlockedAttachPin === true || existsStandardWallet) {
    return passphraseProtection === true ? 'hidden' : 'standard';
  }

  if (passphraseProtection !== true) {
    return 'standard';
  }

  return undefined;
}
