import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRewardCenterRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function WalletActionRewardCenter({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, account, wallet } = activeAccount;

  const navigation = useAppNavigation();

  const handleRewardCenter = useCallback(() => {
    onClose();
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalRewardCenterRoutes.RewardCenter,
      params: {
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
        walletId: wallet?.id ?? '',
      },
    });
  }, [navigation, account?.id, network?.id, wallet?.id, onClose]);

  return (
    <ActionList.Item
      trackID="wallet-reward-center"
      icon="GiftOutline"
      label={intl.formatMessage({
        id: ETranslations.wallet_subsidy_redeem_title,
      })}
      onClose={() => {}}
      onPress={handleRewardCenter}
    />
  );
}
