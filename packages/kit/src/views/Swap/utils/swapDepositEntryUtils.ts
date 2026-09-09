import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

// Shared deposit entry for Swap surfaces: opens the reusable ReceiveSelector
// (buy / receive / exchange options) prefilled with the given swap token.
// Active-account hooks always return an object, so require a real account id
// here — otherwise the ReceiveSelector would open dead with empty route
// params. Returns whether the selector was actually opened so callers can
// gate follow-ups (e.g. analytics) on it.
export function pushSwapReceiveSelector({
  navigation,
  token,
  accountInfo,
}: {
  navigation: ReturnType<typeof useAppNavigation>;
  token: ISwapToken;
  accountInfo: IAccountSelectorActiveAccountInfo;
}): boolean {
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
    },
  });
  return true;
}
