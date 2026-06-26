import type { ISwapAlertState } from '@onekeyhq/shared/types/swap/types';

export function shouldAllowSwapNoConnectWalletWarning({
  accountInfoReady,
  accountSelectorActiveAccountInitDone,
  accountSelectorStorageInitDone,
  hasAccountWallet,
  isWebDappMode,
  walletListResolvedNoWallet,
}: {
  accountInfoReady: boolean | undefined;
  accountSelectorActiveAccountInitDone: boolean;
  accountSelectorStorageInitDone: boolean;
  hasAccountWallet: boolean;
  isWebDappMode: boolean;
  walletListResolvedNoWallet: boolean;
}) {
  if (!accountInfoReady || hasAccountWallet) {
    return false;
  }

  if (isWebDappMode) {
    return true;
  }

  return (
    accountSelectorStorageInitDone &&
    accountSelectorActiveAccountInitDone &&
    walletListResolvedNoWallet
  );
}

export function removeSwapNoConnectWalletAlerts(states: ISwapAlertState[]) {
  return states.filter((item) => !item.noConnectWallet);
}
