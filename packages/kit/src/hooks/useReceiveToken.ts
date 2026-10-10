import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IWalletActionSource } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/walletActions';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IAggregateTokenSelectContext,
  IModalReceiveParamList,
  IReceiveNetworkSelection,
  IReceiveSwitchEntry,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IAccountToken,
  IToken,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { buildReceiveNetworkSecondaryTab } from '../views/Receive/components/ReceiveNetworkList';

import { useAccountData } from './useAccountData';

function useReceiveToken({
  accountId,
  networkId,
  walletId,
  tokens,
  tokenListState,
  isMultipleDerive,
  indexedAccountId,
  exchangeSource,
  isAllNetworks,
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
  exchangeSource?: EExchangeId;
}) {
  const intl = useIntl();
  const {
    vaultSettings,
    account: _account,
    network,
    wallet,
  } = useAccountData({
    networkId,
    accountId,
    walletId,
  });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();
  const handleOnReceive = useCallback(
    async ({
      token,
      withAllAggregateTokens,
      sameModal,
      useSelector,
      switchEntry,
      source,
    }: {
      token?: IToken;
      withAllAggregateTokens?: boolean;
      sameModal?: boolean;
      useSelector?: boolean;
      // Direct-to-QR callers opt in per call (token details); fixed-destination
      // callers (gas top-up, bulk revoke) leave it off. The token list path
      // below always opts in.
      switchEntry?: IReceiveSwitchEntry;
      // Analytics: the entry that opened the flow.
      source?: IWalletActionSource;
    }) => {
      // Home mode. Callers whose own networkId is a single chain while the
      // home is under All Networks (token details member tab) say so.
      const isAllNetworksMode =
        isAllNetworks ?? networkUtils.isAllNetwork({ networkId });
      // The in-page network switch exists only under All Networks: there
      // the home shows whatever arrives on the other chain. In
      // single-network mode a switched address would receive funds the
      // home does not show, so the QR page stays on the current chain.
      const resolvedSwitchEntry = isAllNetworksMode ? switchEntry : undefined;
      if (useSelector) {
        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveSelector,
        });
        return;
      }

      if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
        if (sameModal) {
          navigation.push(EModalReceiveRoutes.CreateInvoice, {
            networkId,
            accountId,
          });
          return;
        }

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
          if (sameModal) {
            navigation.push(EModalReceiveRoutes.ReceiveToken, {
              networkId,
              accountId: '',
              walletId,
              token: token ?? tokens?.data?.[0],
              indexedAccountId,
              source,
              isAllNetworksMode,
            });
            return;
          }
          navigation.pushModal(EModalRoutes.ReceiveModal, {
            screen: EModalReceiveRoutes.ReceiveToken,
            params: {
              networkId,
              accountId: '',
              walletId,
              token: token ?? tokens?.data?.[0],
              indexedAccountId,
              source,
              isAllNetworksMode,
            },
          });
          return;
        }

        if (sameModal) {
          navigation.push(EModalReceiveRoutes.ReceiveToken, {
            networkId,
            accountId,
            walletId,
            token,
            indexedAccountId,
            disableSelector: true,
            switchEntry: resolvedSwitchEntry,
            source,
            isAllNetworksMode,
          });
        } else {
          navigation.pushModal(EModalRoutes.ReceiveModal, {
            screen: EModalReceiveRoutes.ReceiveToken,
            params: {
              networkId,
              accountId,
              walletId,
              token,
              indexedAccountId,
              disableSelector: true,
              switchEntry: resolvedSwitchEntry,
              source,
              isAllNetworksMode,
            },
          });
        }
      } else {
        let allAggregateTokenMap:
          | Record<string, { tokens: IAccountToken[] }>
          | undefined;
        let allAggregateTokens: IAccountToken[] | undefined;

        if (withAllAggregateTokens) {
          const res =
            await backgroundApiProxy.serviceToken.getAllAggregateTokenInfo();
          allAggregateTokenMap = res.allAggregateTokenMap;
          allAggregateTokens = res.allAggregateTokens;
        }

        // Main Receive under All Networks gets the Tokens | Networks layout;
        // single-network scope and exchange deposits keep today's token list.
        const secondaryTab =
          !exchangeSource && isAllNetworksMode
            ? buildReceiveNetworkSecondaryTab({
                intl,
                walletId,
                indexedAccountId,
                accountId,
                walletType: wallet?.type,
                onSelectNetwork: ({
                  network: selectedNetwork,
                  accountId: selectedAccountId,
                }: IReceiveNetworkSelection) => {
                  navigation.push(EModalReceiveRoutes.ReceiveToken, {
                    networkId: selectedNetwork.id,
                    accountId: selectedAccountId,
                    walletId,
                    indexedAccountId,
                    switchEntry: 'network',
                    source: 'network',
                    isAllNetworksMode,
                  });
                },
                onSelectLightning: ({
                  network: selectedNetwork,
                  accountId: selectedAccountId,
                }: IReceiveNetworkSelection) => {
                  navigation.push(EModalReceiveRoutes.CreateInvoice, {
                    networkId: selectedNetwork.id,
                    accountId: selectedAccountId,
                  });
                },
              })
            : undefined;

        const params = {
          allAggregateTokenMap,
          allAggregateTokens,
          aggregateTokenSelectorScreen:
            EModalReceiveRoutes.ReceiveSelectAggregateToken,
          // Named after the "Receive transfer" row that leads here, so the
          // page does not repeat the title of the page before it.
          title: intl.formatMessage({
            id: secondaryTab
              ? ETranslations.receive_transfer
              : ETranslations.global_select_crypto,
          }),
          secondaryTab,
          networkId,
          accountId,
          indexedAccountId,
          tokens,
          tokenListState,
          searchAll: true,
          enableCrossNetworkSearch: true,
          // Receive does not care about holdings — never show the
          // Send-semantics "You don't hold any crypto" browse empty.
          browseEmptyTitle: intl.formatMessage({
            id: ETranslations.token_selector_no_tokens__title,
          }),
          hideDeFiTokens: true,
          closeAfterSelect: false,
          footerTipText: intl.formatMessage({
            id: ETranslations.receive_token_list_footer_text,
          }),
          enableNetworkAfterSelect: true,
          onSelect: async (
            t: IToken,
            selectContext?: IAggregateTokenSelectContext,
          ) => {
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

            // Under All Networks every grouped token shows as an aggregate
            // row, so a plain row is known to belong to no group and the QR
            // page skips its config lookup.
            const switchParams = {
              switchEntry: isAllNetworksMode ? ('token' as const) : undefined,
              aggregateToken: selectContext?.aggregateToken,
              aggregateSubTokenList: selectContext?.aggregateSubTokenList,
              allAggregateTokenList: selectContext?.allAggregateTokenList,
              skipAggregateLookup:
                isAllNetworksMode && !selectContext?.aggregateToken,
              source: exchangeSource ? ('exchange' as const) : source,
              isAllNetworksMode,
            };

            if (
              settings.mergeDeriveAssetsEnabled &&
              // Cross-network hits under a single-network scope (t.networkId
              // differs) need the same derive-aware path as All Networks.
              (network?.isAllNetworks || t.networkId !== networkId) &&
              !accountUtils.isOthersWallet({ walletId })
            ) {
              navigation.push(EModalReceiveRoutes.ReceiveToken, {
                networkId: t.networkId ?? networkId,
                accountId: '',
                walletId,
                token: t,
                indexedAccountId,
                exchangeSource,
                ...switchParams,
              });
              return;
            }

            navigation.push(EModalReceiveRoutes.ReceiveToken, {
              networkId: t.networkId ?? networkId,
              accountId: t.accountId ?? accountId,
              walletId,
              token: t,
              indexedAccountId,
              exchangeSource,
              ...switchParams,
            });
          },
        };

        if (sameModal) {
          navigation.push(EModalReceiveRoutes.ReceiveSelectToken, params);
        } else {
          navigation.pushModal(EModalRoutes.ReceiveModal, {
            screen: EModalReceiveRoutes.ReceiveSelectToken,
            params,
          });
        }
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
      exchangeSource,
      wallet?.type,
      isAllNetworks,
    ],
  );

  return { handleOnReceive };
}

export { useReceiveToken };
