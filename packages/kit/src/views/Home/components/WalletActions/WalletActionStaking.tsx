import { useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function useWalletActionStaking({
  customization,
}: {
  customization?: IActionCustomization;
  showButtonStyle?: boolean;
} = {}) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { network, wallet } = activeAccount;

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const intl = useIntl();

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
  return {
    disabled: customization?.disabled ?? false,
    icon: customization?.icon,
    label: customization?.labelId
      ? intl.formatMessage({ id: customization.labelId })
      : undefined,
    onPress: handleStaking,
  };
}

function WalletActionStaking({
  customization,
  showButtonStyle,
}: {
  customization?: IActionCustomization;
  showButtonStyle?: boolean;
}) {
  const action = useWalletActionStaking({ customization });
  return (
    <RawActions.Staking
      onPress={action.onPress}
      label={action.label}
      icon={action.icon}
      showButtonStyle={showButtonStyle}
      disabled={action.disabled}
      testID={HomeTestIDs.stakingButton}
    />
  );
}

export { useWalletActionStaking, WalletActionStaking };
