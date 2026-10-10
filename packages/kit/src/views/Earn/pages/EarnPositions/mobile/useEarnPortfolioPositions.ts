import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useEarnPortfolioPositionsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import { useEarnAccountKey } from '../../../hooks/useEarnAccountKey';

import {
  EMPTY_POSITIONS_RESPONSE,
  buildPositionsRequests,
  mergePortfolioPositionsResponses,
} from './earnPortfolioPositions.utils';

import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';

const EMPTY_CACHE: Record<string, IEarnPortfolioPositionsResponse> = {};

/**
 * Every position of the active wallet across its earn accounts, fetched one
 * (account, network, provider) scope at a time so the page fills in as the
 * scopes land. The last responses stay in the Earn context per account, so
 * the page opens on what it showed last time and refreshes behind it. A
 * scope that fails keeps what it showed before; a full refresh drops scopes
 * the wallet no longer holds on. `refresh({ provider })` fetches only that
 * provider again, which is what a settled claim / stake asks for.
 */
export function useEarnPortfolioPositions({ isActive }: { isActive: boolean }) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const accountId = account?.id ?? '';
  const indexedAccountId =
    account?.indexedAccountId || indexedAccount?.id || '';
  const accountKey = `${accountId}|${indexedAccountId}`;
  const earnAccountKey = useEarnAccountKey();
  const [cache, setCache] = useEarnPortfolioPositionsAtom();
  const cached = (earnAccountKey && cache[earnAccountKey]) || EMPTY_CACHE;
  // Read by the account-switch effect only; the cache must not re-run it.
  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  const resultsRef = useRef(
    new Map<string, IEarnPortfolioPositionsResponse>(Object.entries(cached)),
  );
  const [results, setResults] = useState<IEarnPortfolioPositionsResponse[]>(
    () => Object.values(cached),
  );
  const [isLoading, setIsLoading] = useState(Object.keys(cached).length === 0);
  const requestIdRef = useRef(0);
  const loadedAccountKeyRef = useRef<string | undefined>(undefined);

  const publish = useCallback(() => {
    setResults(Array.from(resultsRef.current.values()));
    if (earnAccountKey) {
      const byScope = Object.fromEntries(resultsRef.current);
      setCache((prev) => ({ ...prev, [earnAccountKey]: byScope }));
    }
  }, [earnAccountKey, setCache]);

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
      // Only an empty page shows the spinner; cached rows stay on screen
      // while the scopes behind them refresh.
      if (!isPartial && resultsRef.current.size === 0) {
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
        // One scope is one short server call (0.4-1.7 s on the test
        // environment), so the wall time is the number of scopes over the
        // concurrency; eight keeps a 30-scope wallet under a few seconds.
        const limit = pLimit(8);
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
      // Seed the new account from its cache: the keys are the scopes, so a
      // refresh replaces each one in place as it lands.
      const seed = cachedRef.current;
      resultsRef.current = new Map(Object.entries(seed));
      setResults(Object.values(seed));
      setIsLoading(Object.keys(seed).length === 0);
    }
    void refresh();
  }, [accountKey, isActive, refresh]);

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
