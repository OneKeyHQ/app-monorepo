import type { IWalletReferralBindListStatus } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/useFetchWalletsWithBoundStatus';

export type IInviteBindRowKind = 'bind' | 'bound' | 'empty' | 'unknown';

export function getInviteBindRowKind(
  wallets:
    | Array<{
        status: IWalletReferralBindListStatus;
      }>
    | undefined,
): IInviteBindRowKind {
  if (!wallets) {
    return 'unknown';
  }
  if (wallets.length === 0) {
    return 'empty';
  }
  if (wallets.some((wallet) => wallet.status === 'bindable')) {
    return 'bind';
  }
  if (wallets.some((wallet) => wallet.status === 'bound')) {
    return 'bound';
  }
  return 'unknown';
}
