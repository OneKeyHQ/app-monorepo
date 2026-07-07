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
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';

import type { IActionCustomization } from './types';

function WalletActionSwap({
  customization,
  inList,
  onClose,
  showButtonStyle,
}: {
  customization?: IActionCustomization;
  inList?: boolean;
  onClose?: () => void;
  showButtonStyle?: boolean;
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
      // Ext popup/side panel has no Swap tab, so the Trade action opens this
      // modal instead. Omit importNetworkId there to match the tab's
      // "resume the last-selected network/token" behavior: passing
      // importNetworkId forces a default-token re-sync that clears From/To
      // when the current network has no configured defaults (e.g. All
      // Networks), which is why the modal otherwise opens empty.
      const isExtPopupOrSidePanel =
        platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: isExtPopupOrSidePanel
          ? { swapSource: ESwapSource.WALLET_HOME }
          : {
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
        icon={customization?.icon ?? 'SwitchHorOutline'}
        label={intl.formatMessage({
          id: customization?.labelId ?? ETranslations.global_trade,
        })}
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
      label={intl.formatMessage({
        id: customization?.labelId ?? ETranslations.global_trade,
      })}
      icon={customization?.icon}
      showButtonStyle={showButtonStyle}
      disabled={
        customization?.disabled ??
        (vaultSettings?.disabledSwapAction ||
          accountUtils.isUrlAccountFn({ accountId: account?.id ?? '' }))
      }
      trackID="wallet-trade"
      testID={HomeTestIDs.swapButton}
    />
  );
}

export { WalletActionSwap };
