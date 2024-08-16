import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAllTokenListAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

export function useTokenManagement({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
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
      const [hiddenTokens, customTokens] = await Promise.all([
        backgroundApiProxy.serviceCustomToken.getHiddenTokens({
          accountId,
          networkId,
          allNetworkAccountId: isAllNetwork ? accountId : undefined,
        }),
        backgroundApiProxy.serviceCustomToken.getCustomTokens({
          accountId,
          networkId,
          allNetworkAccountId: isAllNetwork ? accountId : undefined,
        }),
      ]);
      const allTokens = [...tokenList.tokens, ...customTokens];
      const uniqueTokens = allTokens.filter(
        (token, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.networkId === token.networkId &&
              t.accountId === token.accountId &&
              t.address === token.address,
          ),
      );
      const addedTokens = uniqueTokens.filter(
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
        },
      ];

      if (hiddenTokens.length) {
        sectionTokens.push({
          title: intl.formatMessage({
            id: ETranslations.manage_token_popular_token,
          }),
          data: hiddenTokens,
        });
      }

      return {
        sectionTokens,
        addedTokens,
      };
    },
    [tokenList, accountId, networkId, isAllNetwork, intl],
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
