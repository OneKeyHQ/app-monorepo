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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';
import { buildWalletHomeSwapInitParams } from './WalletActionSwap.utils';

import type { IActionCustomization } from './types';

interface IWalletActionSwapOptions {
  customization?: IActionCustomization;
  inList?: boolean;
  onClose?: () => void;
  showButtonStyle?: boolean;
}

function useWalletActionSwap({
  customization,
  onClose,
}: IWalletActionSwapOptions = {}) {
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
      const isExtPopupOrSidePanel =
        platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: buildWalletHomeSwapInitParams({
          isExtPopupOrSidePanel,
          networkId: network?.id,
        }),
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

  return {
    disabled:
      customization?.disabled ??
      (vaultSettings?.disabledSwapAction ||
        accountUtils.isUrlAccountFn({ accountId: account?.id ?? '' })),
    icon: customization?.icon,
    label: intl.formatMessage({
      id: customization?.labelId ?? ETranslations.global_trade,
    }),
    onPress: handleOnSwap,
  };
}

function WalletActionSwap(options: IWalletActionSwapOptions) {
  const { customization, inList, showButtonStyle } = options;
  const action = useWalletActionSwap(options);
  if (inList) {
    return (
      <ActionList.Item
        trackID="wallet-trade"
        icon={customization?.icon ?? 'SwitchHorOutline'}
        label={action.label}
        onClose={() => {}}
        onPress={action.onPress}
        disabled={action.disabled}
      />
    );
  }

  return (
    <RawActions.Swap
      onPress={action.onPress}
      label={action.label}
      icon={action.icon}
      showButtonStyle={showButtonStyle}
      disabled={action.disabled}
      trackID="wallet-trade"
      testID={HomeTestIDs.swapButton}
    />
  );
}

export { useWalletActionSwap, WalletActionSwap };
