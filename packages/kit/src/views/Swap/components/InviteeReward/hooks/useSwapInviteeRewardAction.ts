import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useShowSwapInviteeReward } from './useShowSwapInviteeReward';

export function useSwapInviteeRewardAction() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId =
    activeAccount.account?.id ?? activeAccount.indexedAccount?.id;
  const { showSwapInviteeReward } = useShowSwapInviteeReward({
    accountId,
    indexedAccountId: activeAccount.indexedAccount?.id,
  });

  return { showSwapInviteeReward };
}
