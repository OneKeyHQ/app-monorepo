import { useCallback, useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IFetchAccountTokensResp,
  IFetchTokenDetailItem,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  type IFetchSpecifiedTokenSelectorTokensResult,
  type ISpecifiedTokenSelectorTarget,
  fetchSpecifiedTokenSelectorTokens,
} from './utils';

export type ITokenSelectorBalanceTarget = ISpecifiedTokenSelectorTarget & {
  key: string;
};

export type ITokenSelectorBalanceState = {
  detail?: IFetchTokenDetailItem;
  balanceLoaded: boolean;
};

export type ISpecifiedTokenSelectorBalanceSnapshot = {
  balanceStateByKey: Record<string, ITokenSelectorBalanceState>;
  isComplete: boolean;
};

const ZERO_TOKEN_FIAT: ITokenFiat = {
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: 0,
};

function normalizeTokenAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return networkId.startsWith('evm--') ? address.toLowerCase() : address;
}

function buildTargetIdentity(target: ITokenSelectorBalanceTarget) {
  return `${target.networkId}:${normalizeTokenAddress({
    networkId: target.networkId,
    address: target.contractAddress,
  })}:${target.key}`;
}

export function buildSpecifiedTokenSelectorTargetsKey(
  targets: ITokenSelectorBalanceTarget[],
) {
  return targets.map(buildTargetIdentity).toSorted().join('|');
}

function findTokenDetail({
  response,
  target,
}: {
  response: IFetchAccountTokensResp;
  target: ITokenSelectorBalanceTarget;
}): IFetchTokenDetailItem | undefined {
  const tokenData = [
    response.tokens,
    response.smallBalanceTokens,
    response.riskTokens,
    response.allTokens,
  ].filter((item) => Boolean(item));
  const expectedAddress = normalizeTokenAddress({
    networkId: target.networkId,
    address: target.contractAddress,
  });

  for (const data of tokenData) {
    const token = data?.data.find(
      (item) =>
        normalizeTokenAddress({
          networkId: target.networkId,
          address: item.address,
        }) === expectedAddress,
    );
    if (token) {
      return {
        info: token,
        ...(data?.map[token.$key] ?? ZERO_TOKEN_FIAT),
      };
    }
  }
  return undefined;
}

function mergeWithCachedSnapshot({
  snapshot,
  cachedSnapshot,
}: {
  snapshot: ISpecifiedTokenSelectorBalanceSnapshot;
  cachedSnapshot: ISpecifiedTokenSelectorBalanceSnapshot | undefined;
}): ISpecifiedTokenSelectorBalanceSnapshot {
  if (snapshot.isComplete || !cachedSnapshot) {
    return snapshot;
  }
  return {
    balanceStateByKey: Object.fromEntries(
      Object.entries(snapshot.balanceStateByKey).map(([key, state]) => [
        key,
        state.balanceLoaded
          ? state
          : (cachedSnapshot.balanceStateByKey[key] ?? state),
      ]),
    ),
    isComplete: false,
  };
}

export function useSpecifiedTokenSelectorBalances({
  accountId,
  networkId,
  indexedAccountId,
  targets,
  enabled = true,
}: {
  accountId?: string;
  networkId?: string;
  indexedAccountId?: string;
  targets: ITokenSelectorBalanceTarget[];
  enabled?: boolean;
}) {
  const targetsKey = buildSpecifiedTokenSelectorTargetsKey(targets);
  const swrKey = useMemo(
    () =>
      enabled && accountId && networkId && targetsKey
        ? swrKeys.specifiedTokenSelectorView({
            accountId,
            networkId,
            indexedAccountId,
            targetsKey,
          })
        : undefined,
    [accountId, enabled, indexedAccountId, networkId, targetsKey],
  );
  const { result, isLoading, run } = usePromiseResult<
    ISpecifiedTokenSelectorBalanceSnapshot | undefined
  >(
    async () => {
      if (!enabled || !targets.length) {
        return undefined;
      }

      const tokenInfoEntriesPromise = Promise.all(
        targets.map(async (target) => {
          const tokenInfo = await backgroundApiProxy.serviceToken
            .fetchTokenInfoOnly({
              networkId: target.networkId,
              tokenAddress: target.contractAddress,
            })
            .catch(() => undefined);
          return [target.key, tokenInfo] as const;
        }),
      );
      const emptyResponse: IFetchSpecifiedTokenSelectorTokensResult = {
        responsesByNetworkId: {},
        expectedResponseCount: new Set(
          targets.map((target) => target.networkId),
        ).size,
      };
      const { responsesByNetworkId, expectedResponseCount } =
        accountId && networkId
          ? await fetchSpecifiedTokenSelectorTokens({
              accountId,
              networkId,
              indexedAccountId,
              targets,
            }).catch(() => emptyResponse)
          : emptyResponse;
      const tokenInfoByKey = Object.fromEntries(
        await tokenInfoEntriesPromise,
      ) as Record<string, IFetchTokenDetailItem | undefined>;
      const snapshot: ISpecifiedTokenSelectorBalanceSnapshot = {
        balanceStateByKey: Object.fromEntries(
          targets.map((target) => {
            const response = responsesByNetworkId[target.networkId];
            const detail = response
              ? findTokenDetail({ response, target })
              : undefined;
            const tokenInfo = tokenInfoByKey[target.key];
            return [
              target.key,
              {
                detail:
                  detail ??
                  (response && tokenInfo
                    ? {
                        info: tokenInfo.info,
                        ...ZERO_TOKEN_FIAT,
                      }
                    : tokenInfo),
                balanceLoaded: Boolean(response),
              },
            ];
          }),
        ),
        isComplete:
          Object.keys(responsesByNetworkId).length === expectedResponseCount,
      };
      return mergeWithCachedSnapshot({
        snapshot,
        cachedSnapshot: swrKey
          ? swrCacheUtils.get<ISpecifiedTokenSelectorBalanceSnapshot>(swrKey)
          : undefined,
      });
    },
    [accountId, enabled, indexedAccountId, networkId, swrKey, targets],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      swrKey,
      swrShouldPersist: (snapshot) => snapshot?.isComplete === true,
    },
  );

  const refresh = useCallback(async () => {
    await run();
  }, [run]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleAccountDataUpdate = () => {
      void refresh();
    };
    appEventBus.on(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdate,
    );
    appEventBus.on(EAppEventBusNames.RefreshTokenList, handleAccountDataUpdate);
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountDataUpdate,
        handleAccountDataUpdate,
      );
      appEventBus.off(
        EAppEventBusNames.RefreshTokenList,
        handleAccountDataUpdate,
      );
    };
  }, [enabled, refresh]);

  return {
    balanceStateByKey: result?.balanceStateByKey,
    isComplete: result?.isComplete,
    isLoading: Boolean(isLoading && !result),
    isRefreshing: Boolean(isLoading && result),
    refresh,
  };
}
