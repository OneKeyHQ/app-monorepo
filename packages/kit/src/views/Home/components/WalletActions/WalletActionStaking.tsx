import { useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionStaking({
  customization,
  showButtonStyle,
}: {
  customization?: IActionCustomization;
  showButtonStyle?: boolean;
}) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, wallet } = activeAccount;

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleStaking = useCallback(() => {
    defaultLogger.wallet.walletActions.actionStaking({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });

    if (customization?.onPress) {
      void customization.onPress();
    } else {
      noop();
    }
  }, [customization, isSoftwareWalletOnlyUser, network?.id, wallet?.type]);
  return (
    <RawActions.Staking
      onPress={handleStaking}
      label={
        customization?.label ??
        intl.formatMessage({
          id: customization?.labelId ?? ETranslations.wallet_tron_trx_staking,
        })
      }
      icon={customization?.icon}
      showButtonStyle={showButtonStyle}
      disabled={customization?.disabled}
    />
  );
}

export { WalletActionStaking };
