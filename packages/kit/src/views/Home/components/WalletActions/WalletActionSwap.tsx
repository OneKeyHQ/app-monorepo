import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, type IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionSwap({
  customization,
  inList,
  onClose,
}: {
  customization?: IActionCustomization;
  inList?: boolean;
  onClose?: () => void;
}) {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleOnSwap = useCallback(() => {
    defaultLogger.wallet.walletActions.actionTrade({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      tradeType: ESwapTabSwitchType.SWAP,
      isSoftwareWalletOnlyUser,
    });

    if (customization?.onPress) {
      void customization.onPress();
    } else {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importNetworkId: network?.id ?? '',
          swapSource: ESwapSource.WALLET_HOME,
        },
      });
    }

    onClose?.();
  }, [
    wallet?.type,
    network?.id,
    isSoftwareWalletOnlyUser,
    customization,
    onClose,
    navigation,
  ]);

  if (inList) {
    return (
      <ActionList.Item
        trackID="wallet-trade"
        icon={customization?.icon ?? 'SwitchHorSolid'}
        label={
          customization?.label ??
          intl.formatMessage({ id: ETranslations.global_trade })
        }
        onClose={() => {}}
        onPress={handleOnSwap}
        disabled={
          customization?.disabled ??
          (vaultSettings?.disabledSwapAction ||
            accountUtils.isUrlAccountFn({ accountId: account?.id ?? '' }))
        }
      />
    );
  }

  return (
    <RawActions.Swap
      onPress={handleOnSwap}
      label={customization?.label}
      icon={customization?.icon}
      disabled={
        customization?.disabled ??
        (vaultSettings?.disabledSwapAction ||
          accountUtils.isUrlAccountFn({ accountId: account?.id ?? '' }))
      }
      trackID="wallet-trade"
    />
  );
}

export { WalletActionSwap };
