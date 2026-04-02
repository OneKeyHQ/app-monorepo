import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IActionCustomization } from './types';

export function WalletActionVote({
  customization,
  onClose,
}: {
  customization?: IActionCustomization;
  onClose: () => void;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, wallet } = activeAccount;

  const intl = useIntl();

  const handleVote = useCallback(async () => {
    defaultLogger.wallet.walletActions.actionVote({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
    });

    onClose();

    setTimeout(() => {
      void customization?.onPress?.();
    });
  }, [wallet?.type, network?.id, customization, onClose]);

  return (
    <ActionList.Item
      trackID="wallet-vote"
      icon={customization?.icon ?? 'ArchiveBoxOutline'}
      label={
        customization?.label ??
        intl.formatMessage({
          id: ETranslations.wallet_tron_votes_management,
        })
      }
      onClose={() => {}}
      onPress={handleVote}
    />
  );
}
