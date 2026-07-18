import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

export type INativeHomeWalletState = 'pending' | 'notBackedUp' | 'normal';

export function resolveNativeHomeWalletState({
  activeAccountReady,
  accountSelectorStorageInitDone,
  activeAccountInitDone,
  walletType,
  walletBackedUp,
}: {
  activeAccountReady: boolean;
  accountSelectorStorageInitDone: boolean;
  activeAccountInitDone: boolean;
  walletType: string | undefined;
  walletBackedUp: boolean | undefined;
}): INativeHomeWalletState {
  if (
    !activeAccountReady ||
    !accountSelectorStorageInitDone ||
    !activeAccountInitDone
  ) {
    return 'pending';
  }

  if (walletType === WALLET_TYPE_HD && !walletBackedUp) {
    return 'notBackedUp';
  }

  return 'normal';
}
