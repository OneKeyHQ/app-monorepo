import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAssetSelectorRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAccountToken,
  IToken,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import { useAccountData } from './useAccountData';

function useReceiveToken({
  accountId,
  networkId,
  walletId,
  deriveInfo,
  deriveType,
  token,
  tokens,
  tokenListState,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  deriveInfo: IAccountDeriveInfo | undefined;
  deriveType: IAccountDeriveTypes;
  token: IAccountToken | undefined;
  isAllNetworks?: boolean;
  tokens?: ITokenData;
  tokenListState?: {
    isRefreshing: boolean;
    initialized: boolean;
  };
}) {
  const { vaultSettings, network } = useAccountData({ networkId, accountId });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const handleOnReceive = useCallback(() => {
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.CreateInvoice,
        params: {
          networkId,
          accountId,
        },
      });
      return;
    }

    if (!deriveInfo) return;

    if (vaultSettings?.isSingleToken || token) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId,
          accountId,
          walletId,
          deriveInfo,
          deriveType,
          token,
        },
      });
    } else {
      navigation.pushModal(EModalRoutes.AssetSelectorModal, {
        screen: EAssetSelectorRoutes.TokenSelector,
        params: {
          networkId,
          accountId,
          networkName: network?.name,
          tokens,
          tokenListState,
          onSelect: async (t: IToken) => {
            await timerUtils.wait(600);
            navigation.pushModal(EModalRoutes.ReceiveModal, {
              screen: EModalReceiveRoutes.ReceiveToken,
              params: {
                networkId,
                accountId,
                walletId,
                deriveInfo,
                deriveType,
                token: t,
              },
            });
          },
          isAllNetworks: network?.isAllNetworks,
        },
      });
    }
  }, [
    accountId,
    deriveInfo,
    deriveType,
    navigation,
    network?.isAllNetworks,
    network?.name,
    networkId,
    token,
    tokenListState,
    tokens,
    vaultSettings?.isSingleToken,
    walletId,
  ]);

  return { handleOnReceive };
}

export { useReceiveToken };
