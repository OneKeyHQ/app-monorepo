import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISwapAlertState } from '@onekeyhq/shared/types/swap/types';

export function shouldAllowSwapNoConnectWalletWarning({
  accountInfoReady,
  accountSelectorActiveAccountInitDone,
  accountSelectorStorageInitDone,
  hasAccount,
  hasAccountWallet,
  isWebDappMode,
  walletListResolvedNoWallet,
}: {
  accountInfoReady: boolean | undefined;
  accountSelectorActiveAccountInitDone: boolean;
  accountSelectorStorageInitDone: boolean;
  hasAccount: boolean;
  hasAccountWallet: boolean;
  isWebDappMode: boolean;
  walletListResolvedNoWallet: boolean;
}) {
  if (!accountInfoReady) {
    return false;
  }

  if (isWebDappMode) {
    return !hasAccount;
  }

  if (hasAccountWallet) {
    return false;
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

export function shouldShowSwapAccountUnsupportedAlert({
  hasFromToken,
  fromAddress,
  walletId,
  accountId,
}: {
  hasFromToken: boolean;
  fromAddress: string | undefined;
  walletId: string | undefined;
  accountId: string | undefined;
}) {
  if (!hasFromToken || fromAddress || !walletId || !accountId) {
    return false;
  }

  return (
    !accountUtils.isHdWallet({ walletId }) &&
    !accountUtils.isHwWallet({ walletId }) &&
    !accountUtils.isQrWallet({ walletId })
  );
}
