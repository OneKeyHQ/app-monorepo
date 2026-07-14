import { shouldKeepCurrentActiveAccountForIncompleteSelection } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/activeAccountInitGuard';

export enum ESwapProAccountStatus {
  NO_ACCOUNT = 'noAccount',
  PENDING = 'pending',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

export enum ESwapProErrorAlertAction {
  CLEAR = 'clear',
  PRESERVE = 'preserve',
  QUOTE_ERROR = 'quoteError',
  UNSUPPORTED = 'unsupported',
}

export function buildSwapProAccountScope({
  targetNetworkId,
  indexedAccountId,
  accountId,
}: {
  targetNetworkId: string;
  indexedAccountId: string | undefined;
  accountId: string | undefined;
}) {
  if (!targetNetworkId || (!indexedAccountId && !accountId)) {
    return '';
  }

  return `${targetNetworkId}|${indexedAccountId ?? ''}|${accountId ?? ''}`;
}

export function resolveSwapProAccountIdentity({
  isAccountSelectorStorageInitDone,
  selectedNetworkId,
  selectedWalletId,
  selectedFocusedWallet,
  selectedIndexedAccountId,
  selectedAccountId,
  activeIndexedAccountId,
  activeAccountId,
}: {
  isAccountSelectorStorageInitDone: boolean;
  selectedNetworkId: string | undefined;
  selectedWalletId?: string;
  selectedFocusedWallet?: string;
  selectedIndexedAccountId: string | undefined;
  selectedAccountId: string | undefined;
  activeIndexedAccountId: string | undefined;
  activeAccountId: string | undefined;
}) {
  const shouldKeepActiveAccount =
    shouldKeepCurrentActiveAccountForIncompleteSelection({
      storageInitDone: isAccountSelectorStorageInitDone,
      selectedAccount: {
        networkId: selectedNetworkId,
        walletId: selectedWalletId,
        focusedWallet: selectedFocusedWallet,
        indexedAccountId: selectedIndexedAccountId,
        othersWalletAccountId: selectedAccountId,
      },
      activeAccount: {
        indexedAccount: activeIndexedAccountId
          ? { id: activeIndexedAccountId }
          : undefined,
        account: activeAccountId ? { id: activeAccountId } : undefined,
      },
    });
  if (shouldKeepActiveAccount) {
    return {
      indexedAccountId: activeIndexedAccountId,
      accountId: activeIndexedAccountId ? undefined : activeAccountId,
    };
  }

  if (
    isAccountSelectorStorageInitDone ||
    selectedIndexedAccountId ||
    selectedAccountId
  ) {
    return {
      indexedAccountId: selectedIndexedAccountId,
      accountId: selectedIndexedAccountId ? undefined : selectedAccountId,
    };
  }

  return {
    indexedAccountId: activeIndexedAccountId,
    accountId: activeIndexedAccountId ? undefined : activeAccountId,
  };
}

export function resolveSwapProAccountStatus({
  hasConnectedAccount,
  accountScope,
  resolvedAccountScope,
  accountAddress,
}: {
  hasConnectedAccount: boolean;
  accountScope: string;
  resolvedAccountScope: string;
  accountAddress: string | undefined;
}) {
  if (!hasConnectedAccount) {
    return ESwapProAccountStatus.NO_ACCOUNT;
  }

  if (!accountScope || resolvedAccountScope !== accountScope) {
    return ESwapProAccountStatus.PENDING;
  }

  return accountAddress
    ? ESwapProAccountStatus.SUPPORTED
    : ESwapProAccountStatus.UNSUPPORTED;
}

export function getSwapProAccountForCurrentScope<T>({
  accountScope,
  resolvedAccountScope,
  account,
}: {
  accountScope: string;
  resolvedAccountScope: string;
  account: T | undefined;
}) {
  if (!accountScope || resolvedAccountScope !== accountScope) {
    return undefined;
  }
  return account;
}

export function getSwapProErrorAlertAction({
  isSwapProActive,
  previousAccountScope,
  accountScope,
  accountStatus,
  hasQuoteError,
}: {
  isSwapProActive: boolean;
  previousAccountScope: string;
  accountScope: string;
  accountStatus: ESwapProAccountStatus;
  hasQuoteError: boolean;
}) {
  if (!isSwapProActive || accountStatus === ESwapProAccountStatus.NO_ACCOUNT) {
    return ESwapProErrorAlertAction.CLEAR;
  }

  if (accountStatus === ESwapProAccountStatus.PENDING) {
    return accountScope && previousAccountScope === accountScope
      ? ESwapProErrorAlertAction.PRESERVE
      : ESwapProErrorAlertAction.CLEAR;
  }

  if (accountStatus === ESwapProAccountStatus.UNSUPPORTED) {
    return ESwapProErrorAlertAction.UNSUPPORTED;
  }

  return hasQuoteError
    ? ESwapProErrorAlertAction.QUOTE_ERROR
    : ESwapProErrorAlertAction.CLEAR;
}

export function shouldSyncSwapProAccountNetwork({
  isSwapProActive,
  targetNetworkId,
  currentNetworkId,
  hasConnectedAccount,
  hasIndexedAccount,
  isSingletonAccountReady,
  isSingletonAccountCompatible,
}: {
  isSwapProActive: boolean;
  targetNetworkId: string;
  currentNetworkId: string | undefined;
  hasConnectedAccount: boolean;
  hasIndexedAccount: boolean;
  isSingletonAccountReady: boolean;
  isSingletonAccountCompatible: boolean;
}) {
  if (
    !isSwapProActive ||
    !targetNetworkId ||
    currentNetworkId === targetNetworkId
  ) {
    return false;
  }

  if (!hasConnectedAccount || hasIndexedAccount) {
    return true;
  }

  return isSingletonAccountReady && isSingletonAccountCompatible;
}
