import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import type {
  IHomeHeaderData,
  IHomeTokenListData,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityHomePageData';
import { calculateAccountTokensValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHomeHeaderActions } from '../../../states/jotai/contexts/homeHeader';
import { useTokenListActions } from '../../../states/jotai/contexts/tokenList';

// Build V2 header + tokenList data from the V1 atom-compatible data.
// This is the bridge between old data sources and new flat stores.
export function buildHomeHeaderDataFromWorth({
  accountId,
  networkId,
  worthMap,
  createAtNetworkWorth,
  defiNetWorth,
  mergeDeriveAssetsEnabled,
}: {
  accountId: string;
  networkId: string;
  worthMap: Record<string, string>;
  createAtNetworkWorth: string;
  defiNetWorth: string;
  mergeDeriveAssetsEnabled: boolean;
}): IHomeHeaderData {
  const tokensWorth = {
    worth: worthMap,
    createAtNetworkWorth,
    accountId,
    initialized: true,
  };
  const tokenWorth = calculateAccountTokensValue({
    accountId,
    networkId,
    tokensWorth,
    mergeDeriveAssetsEnabled,
  });
  const totalBalance = new BigNumber(tokenWorth)
    .plus(defiNetWorth ?? '0')
    .toFixed();

  return {
    totalBalance,
    tokenWorth,
    defiNetWorth,
    tokenWorthMap: worthMap,
    createAtNetworkWorth,
    accountId,
    initialized: true,
    isRefreshing: false,
  };
}

export function buildHomeTokenListData({
  tokens,
  smallBalanceTokens,
  riskyTokens,
  tokenFiatMap,
  smallBalanceFiatValue,
  aggregateTokensMap,
  aggregateTokensListMap,
  allTokens,
}: {
  tokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  riskyTokens: IAccountToken[];
  tokenFiatMap: Record<string, ITokenFiat>;
  smallBalanceFiatValue: string;
  aggregateTokensMap: Record<string, Record<string, ITokenFiat>>;
  aggregateTokensListMap: Record<string, { tokens: IAccountToken[] }>;
  allTokens: IAccountToken[];
}): IHomeTokenListData {
  return {
    tokens,
    smallBalanceTokens,
    riskyTokens,
    tokenFiatMap,
    smallBalanceFiatValue,
    aggregateTokensMap,
    aggregateTokensListMap,
    allTokens,
    initialized: true,
    isRefreshing: false,
  };
}

export function useHomePageDataController() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const { setHomeHeaderData } = useHomeHeaderActions().current;

  const { setHomeTokenListData } = useTokenListActions().current;

  const { updateAccountWorth, updateAccountOverviewState } =
    useAccountOverviewActions().current;

  const {
    refreshTokenList,
    refreshTokenListMap,
    refreshSmallBalanceTokenList,
    refreshSmallBalanceTokenListMap,
    refreshSmallBalanceTokensFiatValue,
    refreshRiskyTokenList,
    refreshRiskyTokenListMap,
    refreshAllTokenList,
    refreshAllTokenListMap,
    refreshAggregateTokensMap,
    refreshAggregateTokensListMap,
    updateTokenListState,
  } = useTokenListActions().current;

  const prevAccountIdRef = useRef<string>('');

  // Dispatch V2 cache data to both new and legacy atoms
  const dispatchV2CacheToStores = useCallback(
    (header: IHomeHeaderData, tokenList: IHomeTokenListData) => {
      // New stores
      setHomeHeaderData(header);
      setHomeTokenListData(tokenList);

      // Legacy atoms (compatibility during transition)
      updateAccountWorth({
        accountId: header.accountId,
        initialized: true,
        worth: header.tokenWorthMap,
        createAtNetworkWorth: header.createAtNetworkWorth,
        updateAll: true,
      });
      updateAccountOverviewState({
        initialized: true,
        isRefreshing: false,
      });
      updateTokenListState({
        initialized: true,
        isRefreshing: false,
      });

      const allFiatMap = {
        ...tokenList.tokenFiatMap,
      };

      refreshTokenList({
        tokens: tokenList.tokens,
        keys: 'homePageCache',
      });
      refreshTokenListMap({
        tokens: allFiatMap,
      });
      refreshSmallBalanceTokenList({
        smallBalanceTokens: tokenList.smallBalanceTokens,
        keys: 'homePageCache',
      });
      refreshSmallBalanceTokenListMap({
        tokens: allFiatMap,
      });
      refreshSmallBalanceTokensFiatValue({
        value: tokenList.smallBalanceFiatValue,
      });
      refreshRiskyTokenList({
        riskyTokens: tokenList.riskyTokens,
        keys: 'homePageCache',
      });
      refreshRiskyTokenListMap({
        tokens: allFiatMap,
      });
      refreshAllTokenList({
        tokens: tokenList.allTokens,
        keys: 'homePageCache_all',
        accountId: account?.id,
        networkId: network?.id,
      });
      refreshAllTokenListMap({
        tokens: allFiatMap,
      });
      refreshAggregateTokensMap({
        tokens: tokenList.aggregateTokensMap,
      });
      refreshAggregateTokensListMap({
        tokens: tokenList.aggregateTokensListMap,
      });
    },
    [
      account?.id,
      network?.id,
      setHomeHeaderData,
      setHomeTokenListData,
      updateAccountWorth,
      updateAccountOverviewState,
      updateTokenListState,
      refreshTokenList,
      refreshTokenListMap,
      refreshSmallBalanceTokenList,
      refreshSmallBalanceTokenListMap,
      refreshSmallBalanceTokensFiatValue,
      refreshRiskyTokenList,
      refreshRiskyTokenListMap,
      refreshAllTokenList,
      refreshAllTokenListMap,
      refreshAggregateTokensMap,
      refreshAggregateTokensListMap,
    ],
  );

  // Cold start: load V2 cache and dispatch to all stores
  useEffect(() => {
    if (!account?.id || !network?.id) return;
    if (!network.isAllNetworks) return;

    // Only run on account change to avoid duplicate loads
    if (prevAccountIdRef.current === `${account.id}_${network.id}`) return;
    prevAccountIdRef.current = `${account.id}_${network.id}`;

    void (async () => {
      const cacheV2 = await backgroundApiProxy.serviceToken.getHomePageCacheV2({
        accountId: account.id,
        networkId: network.id,
      });

      if (cacheV2) {
        dispatchV2CacheToStores(cacheV2.header, cacheV2.tokenList);
      }
    })();
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    dispatchV2CacheToStores,
  ]);

  // Save V2 cache whenever accountWorth is updated with fresh data
  // This replaces the two saveHomePageCache calls in TokenListBlock
  return {
    dispatchV2CacheToStores,
    buildHomeHeaderDataFromWorth,
    buildHomeTokenListData,
  };
}
