import { useCallback } from 'react';

import { flatten, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAllTokenListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  buildAggregateTokenListMapKeyForTokenList,
  buildAggregateTokenMapKeyForAggregateConfig,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import {
  ECustomTokenStatus,
  type ICustomTokenItem,
} from '@onekeyhq/shared/types/token';

export function useTokenManagement({
  networkId,
  accountId,
  indexedAccountId,
}: {
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const isAllNetwork = networkId === getNetworkIdsMap().onekeyall;
  const [tokenList] = useAllTokenListAtom();

  const {
    result,
    run,
    isLoading: isLoadingLocalData,
  } = usePromiseResult(
    async () => {
      const pair: {
        accountId: string;
        networkId: string;
        accountXpubOrAddress?: string;
      }[] = [];
      if (isAllNetwork) {
        const { accountsInfo } =
          // same to useAllNetwork()
          await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
            accountId,
            networkId,
            deriveType: undefined,
            nftEnabledOnly: false,
            // disable test network in all networks
            excludeTestNetwork: true,
            // For watching accounts, display all available network data without filtering
            networksEnabledOnly: !accountUtils.isWatchingAccount({
              accountId,
            }),
          });
        pair.push(
          ...accountsInfo.map((account) => ({
            accountId: account.accountId,
            networkId: account.networkId,
          })),
        );
      } else {
        pair.push({ accountId, networkId });
      }

      const aggregateTokenConfigMap =
        await backgroundApiProxy.serviceToken.getAggregateTokenConfigMap();

      // query aggregate tokens in both all networks and single network
      pair.push({
        accountId: indexedAccountId ?? accountId ?? '',
        accountXpubOrAddress: indexedAccountId ?? accountId,
        networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
      });

      const hiddenTokens = flatten(
        await Promise.all(
          pair.map((item) =>
            backgroundApiProxy.serviceCustomToken.getHiddenTokens({
              accountId: item.accountId,
              networkId: item.networkId,
              accountXpubOrAddress: item.accountXpubOrAddress,
            }),
          ),
        ),
      );

      const customTokens = flatten(
        await Promise.all(
          pair.map((item) =>
            backgroundApiProxy.serviceCustomToken.getCustomTokens({
              accountId: item.accountId,
              networkId: item.networkId,
              accountXpubOrAddress: item.accountXpubOrAddress,
            }),
          ),
        ),
      );

      const allTokens = await Promise.all(
        [...tokenList.tokens, ...customTokens].map((token) =>
          backgroundApiProxy.serviceToken.mergeTokenMetadataWithCustomData({
            token,
            customTokens,
            networkId,
          }),
        ),
      );
      const uniqueTokens = uniqBy(allTokens, (token) => token.$key);

      const addedTokens = uniqueTokens
        .map((token) => {
          const aggregateTokenConfigKey =
            buildAggregateTokenMapKeyForAggregateConfig({
              networkId: token.networkId ?? '',
              tokenAddress: token.address,
            });

          const aggregateTokenConfig =
            aggregateTokenConfigMap?.[aggregateTokenConfigKey];

          if (token.isAggregateToken || !aggregateTokenConfig) {
            return token;
          }

          const aggregateTokenKey = buildAggregateTokenListMapKeyForTokenList({
            commonSymbol: aggregateTokenConfig?.commonSymbol ?? '',
          });

          return {
            ...token,
            $key: aggregateTokenKey,
            address: aggregateTokenKey,
            networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
            commonSymbol: aggregateTokenConfig.commonSymbol,
            logoURI: aggregateTokenConfig.logoURI,
            name: aggregateTokenConfig.name,
            isAggregateToken: true,
          };
        })
        .filter(
          (token) =>
            !hiddenTokens.find(
              (t) =>
                t.address === token.address && t.networkId === token.networkId,
            ),
        );
      const sectionTokens = [
        {
          title: intl.formatMessage({
            id: ETranslations.manage_token_added_token,
          }),
          data: addedTokens,
          status: ECustomTokenStatus.Custom,
        },
      ];

      if (hiddenTokens.length) {
        sectionTokens.push({
          title: intl.formatMessage({
            id: ETranslations.manage_token_popular_token,
          }),
          data: hiddenTokens,
          status: ECustomTokenStatus.Hidden,
        });
      }

      return {
        sectionTokens,
        addedTokens,
      };
    },
    [
      isAllNetwork,
      indexedAccountId,
      tokenList.tokens,
      intl,
      accountId,
      networkId,
    ],
    {
      checkIsFocused: false,
      watchLoading: true,
    },
  );

  const { result: networkMaps } = usePromiseResult(
    async () => {
      const networks = await backgroundApiProxy.serviceNetwork.getAllNetworks();
      return networks.networks.reduce<Record<string, IServerNetwork>>(
        (acc, network) => {
          acc[network.id] = network;
          return acc;
        },
        {},
      );
    },
    [],
    {
      initResult: {},
    },
  );

  const checkTokenExistInTokenList = useCallback(
    (token: ICustomTokenItem) =>
      result?.addedTokens?.find(
        (t) => t.address === token.address && t.networkId === token.networkId,
      ),
    [result?.addedTokens],
  );

  return {
    sectionTokens: result?.sectionTokens,
    tokenList: result?.addedTokens,
    refreshTokenLists: run,
    isLoadingLocalData,
    networkMaps,
    checkTokenExistInTokenList,
  };
}
