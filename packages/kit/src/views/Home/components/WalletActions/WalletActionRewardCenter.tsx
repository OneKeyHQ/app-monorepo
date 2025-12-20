import { useCallback } from 'react';

import { ActionList } from '@onekeyhq/components';
import type { IRewardCenterConfig } from '@onekeyhq/kit/src/components/RewardCenter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EModalRewardCenterRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function WalletActionRewardCenter({
  rewardCenterConfig,
  onClose,
}: {
  rewardCenterConfig: IRewardCenterConfig;
  onClose: () => void;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, account, wallet } = activeAccount;

  const navigation = useAppNavigation();

  const handleRewardCenter = useCallback(() => {
    if (rewardCenterConfig) {
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalRewardCenterRoutes.RewardCenter,
        params: {
          accountId: account?.id ?? '',
          networkId: network?.id ?? '',
          walletId: wallet?.id ?? '',
        },
      });
    }
    onClose();
  }, [
    rewardCenterConfig,
    navigation,
    account?.id,
    network?.id,
    wallet?.id,
    onClose,
  ]);

  return (
    <ActionList.Item
      trackID="wallet-reward-center"
      icon={rewardCenterConfig?.icon}
      label={rewardCenterConfig?.title}
      onClose={() => {}}
      onPress={handleRewardCenter}
    />
  );
}
