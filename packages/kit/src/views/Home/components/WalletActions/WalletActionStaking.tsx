import { useCallback } from 'react';

import { noop } from 'lodash';

import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionStaking({
  customization,
}: {
  customization?: IActionCustomization;
}) {
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
      label={customization?.label}
      icon={customization?.icon}
      disabled={customization?.disabled}
    />
  );
}

export { WalletActionStaking };
