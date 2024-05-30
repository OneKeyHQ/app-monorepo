import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function useReceiveToken() {
  const {
    activeAccount: { account, network, wallet, deriveInfo, deriveType },
  } = useActiveAccount({ num: 0 });
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const handleOnReceive = useCallback(() => {
    if (!account || !network || !wallet || !deriveInfo) return;
    if (networkUtils.isLightningNetworkByNetworkId(network.id)) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.CreateInvoice,
        params: {
          networkId: network.id,
          accountId: account.id,
        },
      });
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId: network.id,
        accountId: account.id,
        walletId: wallet.id,
        deriveInfo,
        deriveType,
      },
    });
  }, [account, deriveInfo, deriveType, navigation, network, wallet]);

  return { handleOnReceive };
}

export { useReceiveToken };
