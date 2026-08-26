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

export function shouldShowSwapLocalData({
  accountInfoReady,
  accountSelectorActiveAccountInitDone,
  accountSelectorStorageInitDone,
  hasAccount,
  hasDbAccount,
  hasAccountWallet,
  hasIndexedAccount,
}: {
  accountInfoReady: boolean | undefined;
  accountSelectorActiveAccountInitDone: boolean;
  accountSelectorStorageInitDone: boolean;
  hasAccount: boolean;
  hasDbAccount: boolean;
  hasAccountWallet: boolean;
  hasIndexedAccount: boolean;
}) {
  if (
    !accountInfoReady ||
    !accountSelectorStorageInitDone ||
    !accountSelectorActiveAccountInitDone
  ) {
    return false;
  }

  return hasAccountWallet && (hasAccount || hasDbAccount || hasIndexedAccount);
}

export function buildSwapLimitOrdersAccountIdKey({
  indexedAccountId,
  otherWalletTypeAccountId,
}: {
  indexedAccountId?: string;
  otherWalletTypeAccountId?: string;
}) {
  return indexedAccountId ?? otherWalletTypeAccountId ?? 'noAccountId';
}

export function shouldShowSwapLimitOrders({
  shouldShowLocalData,
  currentAccountIdKey,
  limitOrdersAccountIdKey,
}: {
  shouldShowLocalData: boolean;
  currentAccountIdKey: string;
  limitOrdersAccountIdKey: string | undefined;
}) {
  return (
    shouldShowLocalData &&
    Boolean(limitOrdersAccountIdKey) &&
    currentAccountIdKey === limitOrdersAccountIdKey
  );
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
