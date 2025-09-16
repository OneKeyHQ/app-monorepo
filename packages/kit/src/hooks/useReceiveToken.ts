import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IAccountToken,
  IAggregateToken,
  IToken,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAccountData } from './useAccountData';

function useReceiveToken({
  accountId,
  networkId,
  walletId,
  tokens,
  tokenListState,
  isMultipleDerive,
  indexedAccountId,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  indexedAccountId: string;
  isAllNetworks?: boolean;
  tokens?: ITokenData;
  tokenListState?: {
    isRefreshing: boolean;
    initialized: boolean;
  };
  isMultipleDerive?: boolean;
}) {
  const intl = useIntl();
  const { vaultSettings, account, network } = useAccountData({
    networkId,
    accountId,
  });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const handleOnReceive = useCallback(
    async ({
      token,
      withAllAggregateTokens,
    }: {
      token?: IToken;
      withAllAggregateTokens?: boolean;
    }) => {
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

      if (vaultSettings?.isSingleToken || token) {
        if (
          isMultipleDerive &&
          !accountUtils.isOthersWallet({ walletId }) &&
          vaultSettings?.mergeDeriveAssetsEnabled
        ) {
          navigation.pushModal(EModalRoutes.ReceiveModal, {
            screen: EModalReceiveRoutes.ReceiveToken,
            params: {
              networkId,
              accountId: '',
              walletId,
              token: token ?? tokens?.data?.[0],
              indexedAccountId,
            },
          });
          return;
        }

        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveToken,
          params: {
            networkId,
            accountId,
            walletId,
            token,
            indexedAccountId,
            disableSelector: true,
          },
        });
      } else {
        let allAggregateTokenMap:
          | Record<string, { tokens: IAccountToken[] }>
          | undefined;
        let allAggregateTokens: IAccountToken[] | undefined;

        if (withAllAggregateTokens) {
          const res =
            await backgroundApiProxy.serviceToken.getAllAggregateTokenInfo();
          await backgroundApiProxy.serviceToken.getAllAggregateTokenInfo();
          allAggregateTokenMap = res.allAggregateTokenMap;
          allAggregateTokens = res.allAggregateTokens;
        }

        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveSelectToken,
          params: {
            allAggregateTokenMap,
            allAggregateTokens,
            aggregateTokenSelectorScreen:
              EModalReceiveRoutes.ReceiveSelectAggregateToken,
            title: intl.formatMessage({
              id: ETranslations.global_select_crypto,
            }),
            networkId,
            accountId,
            indexedAccountId,
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
                !accountUtils.isOthersWallet({ walletId })
              ) {
                navigation.push(EModalReceiveRoutes.ReceiveToken, {
                  networkId: t.networkId ?? networkId,
                  accountId: '',
                  walletId,
                  token: t,
                  indexedAccountId,
                });
                return;
              }

              navigation.push(EModalReceiveRoutes.ReceiveToken, {
                networkId: t.networkId ?? networkId,
                accountId: t.accountId ?? accountId,
                walletId,
                token: t,
                indexedAccountId,
              });
            },
          },
        });
      }
    },
    [
      accountId,
      indexedAccountId,
      intl,
      isMultipleDerive,
      navigation,
      network?.isAllNetworks,
      networkId,
      tokenListState,
      tokens,
      vaultSettings?.isSingleToken,
      vaultSettings?.mergeDeriveAssetsEnabled,
      walletId,
    ],
  );

  return { handleOnReceive };
}

export { useReceiveToken };
