import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { buildLocalTxStatusSyncId } from '../../../Staking/utils/utils';

import type {
  IRecommendedRefreshAccount,
  IRecommendedWatchTarget,
} from './types';

function buildRecommendedWatchTargets(tokens: IRecommendAsset[]) {
  return tokens.flatMap<IRecommendedWatchTarget>((token) =>
    (token.protocols ?? [])
      .filter(
        (protocol): protocol is { networkId: string; provider: string } => {
          return Boolean(
            protocol.networkId && protocol.provider && token.symbol,
          );
        },
      )
      .map((protocol) => ({
        networkId: protocol.networkId,
        provider: protocol.provider,
        symbol: token.symbol,
      })),
  );
}

export function useRecommendedRefreshScope({
  accountId,
  indexedAccountId,
  networkId,
  recommendedTokens,
  enableFetch,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  recommendedTokens: IRecommendAsset[];
  enableFetch: boolean;
}) {
  const watchTargets = useMemo(
    () => buildRecommendedWatchTargets(recommendedTokens),
    [recommendedTokens],
  );

  const recommendedNetworkIds = useMemo(
    () => Array.from(new Set(watchTargets.map((target) => target.networkId))),
    [watchTargets],
  );

  const recommendedStakeTags = useMemo(() => {
    const tags = new Set<string>();

    watchTargets.forEach(({ provider, symbol }) => {
      tags.add(
        buildLocalTxStatusSyncId({
          providerName: provider,
          tokenSymbol: symbol,
        }),
      );
    });

    return tags;
  }, [watchTargets]);

  const tagMatcher = useCallback(
    (tag: string) => recommendedStakeTags.has(tag),
    [recommendedStakeTags],
  );

  const { result: refreshEligibleAccounts } = usePromiseResult<
    IRecommendedRefreshAccount[] | undefined
  >(async () => {
    if (!enableFetch || !accountId || !networkId) {
      return undefined;
    }

    try {
      const accounts =
        await backgroundApiProxy.serviceStaking.getEarnAvailableAccounts({
          accountId,
          networkId,
          indexedAccountId,
        });

      return accounts.map((account) => ({
        accountId: account.accountId,
        networkId: account.networkId,
      }));
    } catch {
      return undefined;
    }
  }, [enableFetch, accountId, networkId, indexedAccountId]);

  const refreshEligibleAccountKeys = useMemo(() => {
    if (!refreshEligibleAccounts) {
      return undefined;
    }

    return new Set(
      refreshEligibleAccounts.map(
        (account) => `${account.networkId}__${account.accountId}`,
      ),
    );
  }, [refreshEligibleAccounts]);

  const historyRefreshAccounts = useMemo(() => {
    if (refreshEligibleAccounts?.length) {
      return refreshEligibleAccounts;
    }

    if (!accountId || !networkId) {
      return [];
    }

    return [
      {
        accountId,
        networkId,
      },
    ];
  }, [accountId, networkId, refreshEligibleAccounts]);

  const shouldRefreshByAccounts = useCallback(
    (accounts: IRecommendedRefreshAccount[]) => {
      const allNetworkId = getNetworkIdsMap().onekeyall;

      if (refreshEligibleAccountKeys) {
        return accounts.some((account) =>
          refreshEligibleAccountKeys.has(
            `${account.networkId}__${account.accountId}`,
          ),
        );
      }

      if (networkId === allNetworkId) {
        return true;
      }

      return accounts.some(
        (account) =>
          account.accountId === accountId && account.networkId === networkId,
      );
    },
    [accountId, networkId, refreshEligibleAccountKeys],
  );

  return {
    historyRefreshAccounts,
    recommendedNetworkIds,
    tagMatcher,
    shouldRefreshByAccounts,
  };
}
