import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

// Deposit entry shared by the Top up chips (Swap, Stocks, Pro) and the
// "Deposit to Trade" action button: opens the reusable ReceiveSelector
// (buy / receive / exchange options) prefilled with the token, with a Done
// shortcut on the QR page, and counts the low-balance funnel event once, only
// when the selector actually opened. `onClose` fires when the modal goes away
// (Done, back or swipe) so the caller can reload the balance the user may just
// have topped up. Active-account hooks always return an object, so a real
// account id is required; otherwise the selector would open dead with empty
// route params. Tolerates a missing token or account so callers can bind it
// before those resolve.
export function openSwapDepositEntry({
  navigation,
  token,
  accountInfo,
  onClose,
  logLowBalance = true,
}: {
  navigation: ReturnType<typeof useAppNavigation>;
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  onClose?: () => void;
  // Only entries that exist because the balance is low should count the
  // low-balance funnel event. Always-visible deposit entries, such as the
  // Pro panel's Top up chip, pass false so a sufficient balance does not land
  // in the low-balance funnel.
  logLowBalance?: boolean;
}): boolean {
  if (!token || !accountInfo) return false;
  if (!accountInfo.account?.id && !accountInfo.indexedAccount?.id) {
    return false;
  }
  navigation.pushModal(EModalRoutes.ReceiveModal, {
    screen: EModalReceiveRoutes.ReceiveSelector,
    params: {
      accountId: accountInfo.account?.id ?? '',
      networkId: token.networkId ?? '',
      walletId: accountInfo.wallet?.id ?? '',
      indexedAccountId: accountInfo.indexedAccount?.id,
      token: {
        networkId: token.networkId ?? '',
        address: token.contractAddress ?? '',
        name: token.name ?? '',
        symbol: token.symbol ?? '',
        decimals: token.decimals,
        logoURI: token.logoURI,
        isNative: token.isNative,
      },
      onClose,
      showDoneButton: true,
    },
  });
  if (logLowBalance) {
    defaultLogger.wallet.walletActions.buyOnLowBalance({
      source: 'swap',
      networkId: token.networkId ?? '',
      tokenSymbol: token.symbol ?? '',
      tokenAddress: token.contractAddress ?? '',
      walletType: accountInfo.wallet?.type ?? '',
    });
  }
  return true;
}
