import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';
import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAccountData } from './useAccountData';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function useReceiveToken({
  accountId,
  networkId,
  walletId,
  deriveInfo,
  deriveType,
  tokens,
  tokenListState,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  deriveInfo: IAccountDeriveInfo | undefined;
  deriveType: IAccountDeriveTypes;
  isAllNetworks?: boolean;
  tokens?: ITokenData;
  tokenListState?: {
    isRefreshing: boolean;
    initialized: boolean;
  };
}) {
  const intl = useIntl();
  const { vaultSettings, account, network } = useAccountData({
    networkId,
    accountId,
  });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const handleOnReceive = useCallback(
    (token?: IToken) => {
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
        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveSelectToken,
          params: {
            title: intl.formatMessage({ id: ETranslations.global_receive }),
            networkId,
            accountId,
            tokens,
            tokenListState,
            searchAll: true,
            closeAfterSelect: false,
            onSelect: async (t: IToken) => {
              if (networkUtils.isLightningNetworkByNetworkId(t.networkId)) {
                navigation.pushModal(EModalRoutes.ReceiveModal, {
                  screen: EModalReceiveRoutes.CreateInvoice,
                  params: {
                    networkId: t.networkId ?? '',
                    accountId: t.accountId ?? '',
                  },
                });
                return;
              }

              const settings =
                await backgroundApiProxy.serviceNetwork.getVaultSettings({
                  networkId: t.networkId ?? '',
                });

              if (
                settings.mergeDeriveAssetsEnabled &&
                network?.isAllNetworks &&
                (accountUtils.isHdWallet({ walletId }) ||
                  accountUtils.isHwWallet({ walletId }))
              ) {
                navigation.push(
                  EModalReceiveRoutes.ReceiveSelectDeriveAddress,
                  {
                    networkId: t.networkId ?? '',
                    indexedAccountId: account?.indexedAccountId ?? '',
                    token: t,
                    tokenMap: tokens?.map,
                    accountId: t.accountId ?? '',
                    actionType: EDeriveAddressActionType.Select,
                    onSelected: ({
                      account: a,
                      deriveInfo: di,
                      deriveType: dt,
                    }: {
                      account: INetworkAccount;
                      deriveInfo: IAccountDeriveInfo;
                      deriveType: IAccountDeriveTypes;
                    }) => {
                      navigation.push(EModalReceiveRoutes.ReceiveToken, {
                        networkId: t.networkId ?? networkId,
                        accountId: a.id ?? accountId,
                        walletId,
                        deriveInfo: di,
                        deriveType: dt,
                        token: t,
                      });
                    },
                  },
                );
                return;
              }

              navigation.push(EModalReceiveRoutes.ReceiveToken, {
                networkId: t.networkId ?? networkId,
                accountId: t.accountId ?? accountId,
                walletId,
                deriveInfo,
                deriveType,
                token: t,
              });
            },
          },
        });
      }
    },
    [
      account?.indexedAccountId,
      accountId,
      deriveInfo,
      deriveType,
      intl,
      navigation,
      network?.isAllNetworks,
      networkId,
      tokenListState,
      tokens,
      vaultSettings?.isSingleToken,
      walletId,
    ],
  );

  return { handleOnReceive };
}

export { useReceiveToken };
