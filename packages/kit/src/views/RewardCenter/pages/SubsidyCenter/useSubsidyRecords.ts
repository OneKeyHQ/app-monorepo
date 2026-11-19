import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import {
  SUBSIDY_RECENT_RECORD_LIMIT,
  buildSubsidyRecordRow,
  buildSubsidySummaryView,
} from './subsidyRecordUtils';

import type {
  ISubsidyRecordRow,
  ISubsidySummaryView,
} from './subsidyRecordUtils';

export type ISubsidyQuery<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  // `data` still belongs to the previous scope (the page shown before a page
  // change) while the requested one is on its way.
  isPreviousData: boolean;
  reload: () => void;
};

export type ISubsidyRecordListItem = ISubsidyRecordRow & {
  networkName: string;
};

export type ISubsidyHistoryView = {
  items: ISubsidyRecordListItem[];
  // A source failed, so the list may miss records. Not the same as empty.
  isPartial: boolean;
  // More records exist after this page.
  hasMore: boolean;
  // Records in the 90-day window. A number on a first page (0 = none), null
  // when the server could not count them, undefined on every later page.
  total: number | null | undefined;
};

// The identity used when a signed-in session carries no OneKey ID. Nothing
// is cached under it: it cannot tell two users apart.
const UNKNOWN_IDENTITY = 'signed-in';

// Last result per signed-in identity and scope, kept for the app session.
// Reopening the page paints it at once and refreshes behind it, so the page
// does not rebuild from placeholders (and reflow) on every open. Keyed by
// identity: one user's records are never painted for another.
const subsidyQueryCache = new Map<string, unknown>();

export function clearSubsidyRecordsCache() {
  subsidyQueryCache.clear();
}

type ISubsidyQueryState<T> = {
  data: T | undefined;
  // The scope `data` was loaded for.
  dataScope: string | undefined;
  isLoading: boolean;
  isError: boolean;
};

const emptyQueryState = {
  data: undefined,
  dataScope: undefined,
  isLoading: false,
  isError: false,
};
const loadingQueryState = { ...emptyQueryState, isLoading: true };
const errorQueryState = { ...emptyQueryState, isError: true };

// Loads once per signed-in identity and scope. History and summary share a
// per-member rate limit on the server, so there is no polling and no refetch
// on focus; the other triggers are a scope change (another page) and an
// explicit reload (a retry, or a refresh after a claim).
//
// What stays on screen while a request is in flight:
// - reload: the current data, replaced when the response arrives and kept if
//   the refresh fails;
// - scope change with `keepPreviousData`: the previous scope's data, so a
//   page change does not blank the list;
// - identity change: nothing. Another user's records never stay visible.
function useSubsidyQuery<T>({
  identity,
  scope,
  enabled = true,
  keepPreviousData = false,
  fetcher,
}: {
  identity: string | undefined;
  scope: string;
  // False while an input of the request is still unknown; sends nothing.
  enabled?: boolean;
  keepPreviousData?: boolean;
  fetcher: () => Promise<T>;
}): ISubsidyQuery<T> {
  const cacheKey =
    identity && identity !== UNKNOWN_IDENTITY
      ? `${scope}:${identity}`
      : undefined;
  const [state, setState] = useState<ISubsidyQueryState<T>>(() => {
    if (!identity) {
      return emptyQueryState;
    }
    const cached = cacheKey
      ? (subsidyQueryCache.get(cacheKey) as T | undefined)
      : undefined;
    return cached === undefined
      ? loadingQueryState
      : { ...emptyQueryState, data: cached, dataScope: scope };
  });
  const requestRef = useRef(0);
  const dataIdentityRef = useRef(identity);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async ({ isReload }: { isReload: boolean }) => {
      requestRef.current += 1;
      const request = requestRef.current;
      if (!identity) {
        dataIdentityRef.current = identity;
        setState(emptyQueryState);
        return;
      }
      const identityChanged = dataIdentityRef.current !== identity;
      dataIdentityRef.current = identity;
      if (!enabled) {
        setState((prev) =>
          !identityChanged && prev.data !== undefined
            ? prev
            : loadingQueryState,
        );
        return;
      }
      const cached = cacheKey
        ? (subsidyQueryCache.get(cacheKey) as T | undefined)
        : undefined;
      setState((prev) => {
        const hasOwnData = prev.data !== undefined && prev.dataScope === scope;
        if (isReload && hasOwnData && !identityChanged) {
          return prev;
        }
        if (cached !== undefined) {
          return { ...emptyQueryState, data: cached, dataScope: scope };
        }
        if (keepPreviousData && !identityChanged && prev.data !== undefined) {
          return { ...prev, isError: false };
        }
        return loadingQueryState;
      });
      try {
        const data = await fetcherRef.current();
        if (requestRef.current === request) {
          if (cacheKey) {
            subsidyQueryCache.set(cacheKey, data);
          }
          setState({ ...emptyQueryState, data, dataScope: scope });
        }
      } catch {
        // The service already silenced the toast. Data of this scope is
        // better than an error; data of another scope would be mislabelled,
        // so it gives way to the retry state.
        if (requestRef.current === request) {
          setState((prev) =>
            prev.data !== undefined && prev.dataScope === scope
              ? prev
              : errorQueryState,
          );
        }
      }
    },
    [identity, scope, enabled, cacheKey, keepPreviousData],
  );

  useEffect(() => {
    void load({ isReload: false });
    return () => {
      // Drop the response of a request that outlives its identity or scope.
      requestRef.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => {
    void load({ isReload: true });
  }, [load]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    isError: state.isError,
    isPreviousData: state.data !== undefined && state.dataScope !== scope,
    reload,
  };
}

async function fetchSubsidySummaryView(): Promise<ISubsidySummaryView> {
  return buildSubsidySummaryView(
    await backgroundApiProxy.serviceGas.fetchSubsidySummary(),
  );
}

async function fetchSubsidyHistoryView({
  page,
  limit,
}: {
  page: number;
  limit: number;
}): Promise<ISubsidyHistoryView> {
  const history = await backgroundApiProxy.serviceGas.fetchSubsidyHistory({
    limit,
    // The plain first page is the one that carries `total`.
    page: page > 1 ? page : undefined,
  });
  const rows = (Array.isArray(history?.items) ? history.items : []).map(
    buildSubsidyRecordRow,
  );
  const networkNames: Record<string, string> = {};
  try {
    const { networks } =
      await backgroundApiProxy.serviceNetwork.getNetworksByIds({
        networkIds: Array.from(new Set(rows.map((row) => row.networkId))),
      });
    networks.forEach((network) => {
      networkNames[network.id] = network.name;
    });
  } catch {
    // Fall back to the raw network id below.
  }
  let total: number | null | undefined;
  if (page === 1) {
    total =
      typeof history?.total === 'number' && Number.isFinite(history.total)
        ? history.total
        : null;
  }
  return {
    items: rows.map((row) => ({
      ...row,
      networkName: networkNames[row.networkId] ?? row.networkId,
    })),
    isPartial: history?.complete === false,
    hasMore: Boolean(history?.nextCursor),
    total,
  };
}

// The signed-in OneKey ID the records belong to; undefined while signed out,
// which clears the data and sends nothing. Switching accounts reloads.
export function useSubsidyIdentity(): string | undefined {
  const { isLoggedIn, user } = useOneKeyAuth();
  if (!isLoggedIn) {
    return undefined;
  }
  return user?.onekeyUserId || UNKNOWN_IDENTITY;
}

export function useSubsidySummary(identity: string | undefined) {
  return useSubsidyQuery({
    identity,
    scope: 'summary',
    fetcher: fetchSubsidySummaryView,
  });
}

// The newest records for the overview, plus the 90-day total.
export function useSubsidyRecentHistory(identity: string | undefined) {
  return useSubsidyQuery({
    identity,
    scope: 'history-recent',
    fetcher: () =>
      fetchSubsidyHistoryView({ page: 1, limit: SUBSIDY_RECENT_RECORD_LIMIT }),
  });
}

// One page of the full list. `pageSize` is undefined until the list has been
// laid out; nothing is requested before that. Changing the page keeps the
// previous page on screen until the new one arrives.
export function useSubsidyHistoryPage(
  identity: string | undefined,
  { page, pageSize }: { page: number; pageSize: number | undefined },
) {
  return useSubsidyQuery({
    identity,
    scope: `history-page:${pageSize ?? 0}:${page}`,
    enabled: pageSize !== undefined,
    keepPreviousData: true,
    fetcher: () => fetchSubsidyHistoryView({ page, limit: pageSize ?? 1 }),
  });
}
