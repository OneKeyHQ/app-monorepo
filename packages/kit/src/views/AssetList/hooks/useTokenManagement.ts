import { useCallback } from 'react';

import { flatten, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getTokenListOwnerCacheAccountId } from '@onekeyhq/kit/src/components/TokenListView/utils';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useListStructureAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
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
  mergeDeriveAddressData,
  tokenListOwnerKey,
  enabled = true,
}: {
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
  mergeDeriveAddressData?: boolean;
  tokenListOwnerKey?: string;
  enabled?: boolean;
}) {
  const intl = useIntl();
  const isAllNetwork = networkId === getNetworkIdsMap().onekeyall;
  // R-#3b: keep a REACTIVE trigger (the home structure generation, which bumps
  // only when the list membership/structure changes — a cheap pushed signal) as
  // a `usePromiseResult` dep, then PULL the merged raw list inside the body. A
  // naive "one-shot PULL + dropped dep" would freeze this Token Manager modal
  // (newly-discovered tokens would never appear). The displayed `tokenList.tokens`
  // is replaced by the PULL result.
  const [listStructure] = useListStructureAtom();
  const ownerAccountId = getTokenListOwnerCacheAccountId({
    accountId,
    indexedAccountId,
    mergeDeriveAddressData,
  });
  const ownerKey =
    tokenListOwnerKey ||
    (ownerAccountId && networkId ? `${ownerAccountId}__${networkId}` : '');
  // Reactive trigger consumed as a dep below (R-#3b); re-runs the PULL when the
  // home list structure changes. The value itself is not needed in the body.
  const structureGeneration = listStructure.generation;

  const {
    result,
    run,
    isLoading: isLoadingLocalData,
  } = usePromiseResult(
    async () => {
      // Reference the trigger so the dep is "used".
      void structureGeneration;
      if (!enabled) {
        return {
          sectionTokens: [],
          addedTokens: [],
          customTokens: [],
        };
      }
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

      // One bridge round-trip for the whole list. The single-item bg method
      // is `Promise.resolve(syncMerge)` so a Promise.all over .map paid 1
      // BgTransport round-trip per token for zero real async work — this
      // pattern shows up as 808 mergeTokenMetadataWithCustomData calls in
      // the OK-perp/swap freeze trace. See ServiceToken
      // .mergeTokenMetadataWithCustomDataBatch for the contract.
      // PULL the merged-with-risky raw list from the BG VM (replaces the deleted
      // `allTokenListAtom` read). PULL-only; the reactive `listStructure`
      // generation dep below re-runs this when the home list changes.
      const rawTokenList = ownerKey
        ? await backgroundApiProxy.serviceTokenViewModel.getRawTokenList({
            ownerKey,
          })
        : { tokens: [] };

      const allTokens =
        await backgroundApiProxy.serviceToken.mergeTokenMetadataWithCustomDataBatch(
          {
            tokens: [...rawTokenList.tokens, ...customTokens],
            customTokens,
            networkId,
          },
        );

      const uniqueTokens = uniqBy(
        allTokens,
        (token) =>
          `${token.accountId ?? ''}_${token.networkId ?? ''}_${token.address}`,
      );

      const addedTokens = uniqBy(
        uniqueTokens
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

            const aggregateTokenKey = buildAggregateTokenListMapKeyForTokenList(
              {
                commonSymbol: aggregateTokenConfig?.commonSymbol ?? '',
              },
            );

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
                  t.address === token.address &&
                  t.networkId === token.networkId,
              ),
          ),
        (token) => token.$key,
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
        customTokens,
      };
    },
    [
      enabled,
      isAllNetwork,
      indexedAccountId,
      // Reactive trigger (R-#3b): re-pull when the home list structure changes.
      structureGeneration,
      ownerKey,
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
    customTokens: result?.customTokens,
    refreshTokenLists: run,
    isLoadingLocalData,
    networkMaps,
    checkTokenExistInTokenList,
  };
}
