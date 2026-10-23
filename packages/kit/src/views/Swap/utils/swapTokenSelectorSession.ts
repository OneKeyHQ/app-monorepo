import type {
  IFetchTokensParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapTokenSelectorLoadOptions,
  buildSwapTokenListCacheKey,
} from './swapTokenSelectorCacheUtils';

type ISessionState = {
  scopeKey: string;
  walletRefreshes: Map<string, Promise<void>>;
  revalidatedQueries: Set<string>;
};

type ISessionRequest = {
  // Account, currency, protocol, network capabilities and event generation.
  // The selected chain and search text deliberately do not start a session.
  scopeKey: string;
  params: IFetchTokensParams;
  walletFilters: (boolean | undefined)[];
  walletRefreshCoversChainLists: boolean;
  queryCoveredByWalletRefresh: boolean;
  isAllNetworks: boolean;
  isCurrent: () => boolean;
  refreshWallet: (lpToken?: boolean) => Promise<void>;
  fetchTokens: (
    params: IFetchTokensParams,
    options?: ISwapTokenSelectorLoadOptions,
  ) => Promise<ISwapToken[] | undefined>;
};

/** One instance per modal. Actions own shared requests; this owns UI intent. */
export function createSwapTokenSelectorSession() {
  let state: ISessionState | undefined;

  return async function load({
    scopeKey,
    params,
    walletFilters,
    walletRefreshCoversChainLists,
    queryCoveredByWalletRefresh,
    isAllNetworks,
    isCurrent,
    refreshWallet,
    fetchTokens,
  }: ISessionRequest): Promise<ISwapToken[] | undefined> {
    if (state?.scopeKey !== scopeKey) {
      state = {
        scopeKey,
        walletRefreshes: new Map(),
        revalidatedQueries: new Set(),
      };
    }
    const session = state;
    const walletRequests = walletFilters.map((filter) => {
      const key = String(filter);
      let request = session.walletRefreshes.get(key);
      if (!request) {
        // Failure leaves the last successful snapshot visible. A new opening
        // or transaction generation retries, not every render or chain click.
        request = refreshWallet(filter).catch(() => undefined);
        session.walletRefreshes.set(key, request);
      }
      return request;
    });

    if (params.keywords) {
      // Search is independent of the wallet sweep and has no completed cache.
      return fetchTokens(params, { throwOnError: true });
    }

    // Full desktop sweeps populate the same chain snapshots as selection.
    // Waiting here avoids a second request if account discovery finishes after
    // an independently fetched selected chain. Cached UI stays visible.
    if (
      walletRefreshCoversChainLists &&
      queryCoveredByWalletRefresh &&
      !isAllNetworks
    ) {
      await Promise.all(walletRequests);
    }
    if (!isCurrent() || state !== session) return undefined;

    const queryKey = buildSwapTokenListCacheKey(params);
    const needsQueryRefresh =
      !session.revalidatedQueries.has(queryKey) &&
      (isAllNetworks || !queryCoveredByWalletRefresh);
    if (needsQueryRefresh) session.revalidatedQueries.add(queryKey);

    const tokens = await fetchTokens(params, {
      policy: needsQueryRefresh ? 'revalidate' : 'snapshot',
      background: true,
      priority: 'foreground',
    });
    // Native uses a separate account-only sweep; preserve its completion gate
    // for all-network lists without delaying independent keyword searches.
    if (!walletRefreshCoversChainLists || isAllNetworks)
      await Promise.all(walletRequests);
    return tokens;
  };
}
