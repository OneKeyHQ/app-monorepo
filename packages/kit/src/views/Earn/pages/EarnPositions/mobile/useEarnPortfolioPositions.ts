import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import {
  EMPTY_POSITIONS_RESPONSE,
  buildPositionsRequests,
  mergePortfolioPositionsResponses,
} from './earnPortfolioPositions.utils';

import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';

/**
 * Every position of the active wallet across its earn accounts, fetched one
 * (account, network, provider) scope at a time so the page fills in as the
 * scopes land. A scope that fails keeps what it showed before; a full refresh
 * drops scopes the wallet no longer holds on. `refresh({ provider })` fetches
 * only that provider again, which is what a settled claim / stake asks for.
 */
export function useEarnPortfolioPositions({ isActive }: { isActive: boolean }) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const accountId = account?.id ?? '';
  const indexedAccountId =
    account?.indexedAccountId || indexedAccount?.id || '';
  const accountKey = `${accountId}|${indexedAccountId}`;

  const resultsRef = useRef(new Map<string, IEarnPortfolioPositionsResponse>());
  const [results, setResults] = useState<IEarnPortfolioPositionsResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);
  const loadedAccountKeyRef = useRef<string | undefined>(undefined);

  const publish = useCallback(() => {
    setResults(Array.from(resultsRef.current.values()));
  }, []);

  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      if (!isActive) {
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      if (!accountId && !indexedAccountId) {
        resultsRef.current.clear();
        publish();
        setIsLoading(false);
        return;
      }
      const isPartial = Boolean(options?.provider || options?.networkId);
      if (!isPartial) {
        setIsLoading(true);
      }
      try {
        const [assets, accounts] = await Promise.all([
          backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
          backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
            accountId,
            networkId: getNetworkIdsMap().onekeyall,
            indexedAccountId,
          }),
        ]);
        if (isStale()) {
          return;
        }
        const requests = buildPositionsRequests({
          accountId,
          assets,
          accounts,
        });
        if (!isPartial) {
          const wanted = new Set(requests.map((request) => request.key));
          Array.from(resultsRef.current.keys()).forEach((key) => {
            if (!wanted.has(key)) {
              resultsRef.current.delete(key);
            }
          });
        }
        const toFetch = isPartial
          ? requests.filter(
              (request) =>
                (!options?.provider || request.provider === options.provider) &&
                (!options?.networkId ||
                  request.networkId === options.networkId),
            )
          : requests;
        const limit = pLimit(6);
        await Promise.all(
          toFetch.map((request) =>
            limit(async () => {
              if (isStale()) {
                return;
              }
              try {
                const response =
                  await backgroundApiProxy.serviceStaking.getPortfolioPositions(
                    request,
                  );
                if (isStale()) {
                  return;
                }
                resultsRef.current.set(request.key, response);
                publish();
              } catch {
                // Keep what this scope showed before; the next refresh retries.
              }
            }),
          ),
        );
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    [isActive, accountId, indexedAccountId, publish],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    if (loadedAccountKeyRef.current !== accountKey) {
      loadedAccountKeyRef.current = accountKey;
      resultsRef.current.clear();
      publish();
      setIsLoading(true);
    }
    void refresh();
  }, [accountKey, isActive, refresh, publish]);

  useEffect(
    () => () => {
      // Unmount: no in-flight scope may publish into a page that is gone.
      requestIdRef.current += 1;
    },
    [],
  );

  const response = useMemo(
    () =>
      results.length > 0
        ? mergePortfolioPositionsResponses(results)
        : EMPTY_POSITIONS_RESPONSE,
    [results],
  );

  return { response, isLoading, refresh };
}
