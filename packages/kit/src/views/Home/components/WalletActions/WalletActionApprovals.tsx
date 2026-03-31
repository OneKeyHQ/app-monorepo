import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useNavigateToApprovalList } from '../../hooks/useNavigateToApprovalList';

export function WalletActionApprovals({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { network, account, wallet } = activeAccount;

  const navigateToApprovalList = useNavigateToApprovalList();

  const handlePress = useCallback(async () => {
    defaultLogger.wallet.walletActions.actionApprovals({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
    });
    onClose();
    await timerUtils.wait(150);
    void navigateToApprovalList({
      networkId: network?.id,
      accountId: account?.id,
      walletId: wallet?.id,
      indexedAccountId: account?.indexedAccountId,
    });
  }, [
    onClose,
    navigateToApprovalList,
    network?.id,
    account?.id,
    wallet?.id,
    wallet?.type,
    account?.indexedAccountId,
  ]);

  return (
    <ActionList.Item
      trackID="wallet-action-approvals"
      icon="ShieldCheckDoneOutline"
      label={intl.formatMessage({
        id: ETranslations.global_approvals,
      })}
      onClose={() => {}}
      onPress={handlePress}
    />
  );
}
