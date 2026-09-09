import { LogToConsoleDevOnly } from '../../../base/decorators';

import { AccountSelectorDevOnlyScene } from './devOnlyScene';

type ISelectedAccountLike = {
  deriveType?: string;
  focusedWallet?: unknown;
  indexedAccountId?: string;
  networkId?: string;
  othersWalletAccountId?: string;
  walletId?: string;
};

function buildSelectionSummary(selectedAccount: ISelectedAccountLike) {
  let accountKind = 'none';
  if (selectedAccount.indexedAccountId) {
    accountKind = 'indexed';
  } else if (selectedAccount.othersWalletAccountId) {
    accountKind = 'others';
  }
  return {
    accountKind,
    deriveType: selectedAccount.deriveType,
    hasFocusedWallet: Boolean(selectedAccount.focusedWallet),
    hasNetwork: Boolean(selectedAccount.networkId),
    hasWallet: Boolean(selectedAccount.walletId),
  };
}

export class AccountSelectorAutoSelectScene extends AccountSelectorDevOnlyScene {
  @LogToConsoleDevOnly()
  public startAutoSelect({
    focusedWallet,
    networkId,
    walletId,
    isAccountExist,
  }: {
    focusedWallet: string | undefined;
    networkId: string | undefined;
    walletId: string | undefined;
    isAccountExist: boolean;
  }) {
    return {
      hasFocusedWallet: Boolean(focusedWallet),
      hasNetwork: Boolean(networkId),
      hasWallet: Boolean(walletId),
      isAccountExist,
    };
  }

  @LogToConsoleDevOnly()
  public currentSelectedAccount({
    selectedAccount,
  }: {
    selectedAccount: ISelectedAccountLike;
  }) {
    return buildSelectionSummary(selectedAccount);
  }

  @LogToConsoleDevOnly()
  public resetSelectedWalletToUndefined({
    selectedAccount,
  }: {
    selectedAccount: ISelectedAccountLike;
  }) {
    return {
      reason: 'wallet-unavailable-or-empty',
      selection: buildSelectionSummary(selectedAccount),
    };
  }
}
