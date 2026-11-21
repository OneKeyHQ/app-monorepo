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
  // A request for the current scope is in flight. `data` can already be on
  // screen (a cached or kept result) and is not final until this clears.
  isFetching: boolean;
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

// The OneKey ID behind an identity: what a request made for that member is
// pinned to. Undefined when the session carries none.
export function getSubsidyMemberId(identity: string | undefined) {
  return identity === UNKNOWN_IDENTITY ? undefined : identity;
}

const HISTORY_PAGE_SCOPE = 'history-page';

// Last result per signed-in identity, then per scope, kept for the app
// session. Reopening the page paints it at once and refreshes behind it, so
// the page does not rebuild from placeholders (and reflow) on every open.
// Keyed by identity first: one user's records are never painted for another,
// and one user's issuance never drops the pages of another.
const subsidyQueryCache = new Map<string, Map<string, unknown>>();

export function clearSubsidyRecordsCache() {
  subsidyQueryCache.clear();
}

function getCachedScopes(identity: string | undefined) {
  return identity && identity !== UNKNOWN_IDENTITY
    ? subsidyQueryCache.get(identity)
    : undefined;
}

function readCache<T>(identity: string | undefined, scope: string) {
  return getCachedScopes(identity)?.get(scope) as T | undefined;
}

function writeCache(identity: string, scope: string, data: unknown) {
  if (identity === UNKNOWN_IDENTITY) {
    return;
  }
  const scopes = subsidyQueryCache.get(identity) ?? new Map<string, unknown>();
  scopes.set(scope, data);
  subsidyQueryCache.set(identity, scopes);
}

// Mounted queries and lists that follow `refreshSubsidyRecords`, called with
// the identity the issuance was made for. A listener leaves the set on
// unmount, so a signal that arrives late (an issuance that completes after
// the page was closed) starts no request for a page that is gone and cannot
// store a response under an identity it no longer shows.
const subsidyRefreshListeners = new Set<(identity: string) => void>();

// A claim or a redemption adds a record and can change the totals of the
// member it was issued to: whatever that member has on screen loads again.
// Their cached pages of the full list are dropped as well, because a new
// record moves every page boundary. `identity` is the member who started the
// issuance, not whoever is signed in when it completes: the response can
// arrive after an account switch, and the next member's records did not
// change.
export function refreshSubsidyRecords(identity: string | undefined) {
  if (!identity) {
    return;
  }
  const scopes = getCachedScopes(identity);
  if (scopes) {
    Array.from(scopes.keys()).forEach((scope) => {
      if (scope.startsWith(`${HISTORY_PAGE_SCOPE}:`)) {
        scopes.delete(scope);
      }
    });
  }
  Array.from(subsidyRefreshListeners).forEach((listener) => listener(identity));
}

// Calls `listener` for the issuances of `identity` only.
export function useSubsidyRecordsRefresh(
  identity: string | undefined,
  listener: () => void,
) {
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => {
    const handleRefresh = (issuedTo: string) => {
      if (issuedTo === identityRef.current) {
        listenerRef.current();
      }
    };
    subsidyRefreshListeners.add(handleRefresh);
    return () => {
      subsidyRefreshListeners.delete(handleRefresh);
    };
  }, []);
}

type ISubsidyQueryState<T> = {
  // The identity this state was produced for. A state of another identity is
  // never rendered, not even for the one render before the effect below
  // replaces it.
  identity: string | undefined;
  data: T | undefined;
  // The scope `data` was loaded for.
  dataScope: string | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
};

// What a query shows before its first response: nothing while signed out,
// the cached result when there is one, a placeholder otherwise.
function getInitialQueryState<T>({
  identity,
  scope,
  enabled,
}: {
  identity: string | undefined;
  scope: string;
  enabled: boolean;
}): ISubsidyQueryState<T> {
  const base = {
    identity,
    data: undefined,
    dataScope: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
  };
  if (!identity) {
    return base;
  }
  const cached = readCache<T>(identity, scope);
  return cached === undefined
    ? { ...base, isLoading: true, isFetching: enabled }
    : { ...base, data: cached, dataScope: scope, isFetching: enabled };
}

// Loads once per signed-in identity and scope. History and summary share a
// per-member rate limit on the server, so there is no polling and no refetch
// on focus; the other triggers are a scope change (another page), an explicit
// reload (a retry) and `refreshSubsidyRecords` (after a claim).
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
  followRefresh = true,
  fetcher,
}: {
  identity: string | undefined;
  scope: string;
  // False while an input of the request is still unknown; sends nothing.
  enabled?: boolean;
  keepPreviousData?: boolean;
  // False when the owner answers `refreshSubsidyRecords` itself.
  followRefresh?: boolean;
  // `onekeyUserId` is the member the result will be shown and cached for;
  // the request must be answered for that member or fail.
  fetcher: (onekeyUserId: string | undefined) => Promise<T>;
}): ISubsidyQuery<T> {
  const [state, setState] = useState<ISubsidyQueryState<T>>(() =>
    getInitialQueryState<T>({ identity, scope, enabled }),
  );
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ isReload }: { isReload: boolean }) => {
      if (!mountedRef.current) {
        return;
      }
      requestRef.current += 1;
      const request = requestRef.current;
      const idle = {
        identity,
        data: undefined,
        dataScope: undefined,
        isLoading: false,
        isError: false,
        isFetching: false,
      };
      if (!identity) {
        setState(idle);
        return;
      }
      if (!enabled) {
        setState((prev) =>
          prev.identity === identity && prev.data !== undefined
            ? { ...prev, isFetching: false }
            : { ...idle, isLoading: true },
        );
        return;
      }
      const cached = readCache<T>(identity, scope);
      setState((prev) => {
        const ownsData = prev.identity === identity && prev.data !== undefined;
        if (isReload && ownsData && prev.dataScope === scope) {
          return { ...prev, isFetching: true };
        }
        if (cached !== undefined) {
          return { ...idle, data: cached, dataScope: scope, isFetching: true };
        }
        if (keepPreviousData && ownsData) {
          return {
            ...prev,
            isLoading: false,
            isError: false,
            isFetching: true,
          };
        }
        return { ...idle, isLoading: true, isFetching: true };
      });
      try {
        const data = await fetcherRef.current(getSubsidyMemberId(identity));
        if (requestRef.current === request) {
          writeCache(identity, scope, data);
          setState({ ...idle, data, dataScope: scope });
        }
      } catch {
        // The service already silenced the toast. Data of this scope is
        // better than an error; data of another scope would be mislabelled,
        // so it gives way to the retry state.
        if (requestRef.current === request) {
          setState((prev) =>
            prev.identity === identity &&
            prev.data !== undefined &&
            prev.dataScope === scope
              ? { ...prev, isFetching: false }
              : { ...idle, isError: true },
          );
        }
      }
    },
    [identity, scope, enabled, keepPreviousData],
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

  useSubsidyRecordsRefresh(identity, () => {
    if (followRefresh) {
      reload();
    }
  });

  // The effect above replaces a state of another identity only after this
  // render is committed; until then it must read as "nothing loaded yet".
  const visible =
    state.identity === identity
      ? state
      : getInitialQueryState<T>({ identity, scope, enabled });

  return {
    data: visible.data,
    isLoading: visible.isLoading,
    isError: visible.isError,
    isPreviousData: visible.data !== undefined && visible.dataScope !== scope,
    isFetching: visible.isFetching,
    reload,
  };
}

async function fetchSubsidySummaryView(
  onekeyUserId: string | undefined,
): Promise<ISubsidySummaryView> {
  return buildSubsidySummaryView(
    await backgroundApiProxy.serviceGas.fetchSubsidySummary({ onekeyUserId }),
  );
}

async function fetchSubsidyHistoryView({
  page,
  limit,
  onekeyUserId,
}: {
  page: number;
  limit: number;
  onekeyUserId: string | undefined;
}): Promise<ISubsidyHistoryView> {
  const history = await backgroundApiProxy.serviceGas.fetchSubsidyHistory({
    onekeyUserId,
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
    fetcher: (onekeyUserId) =>
      fetchSubsidyHistoryView({
        page: 1,
        limit: SUBSIDY_RECENT_RECORD_LIMIT,
        onekeyUserId,
      }),
  });
}

// One page of the full list. `pageSize` is undefined until the list has been
// laid out; nothing is requested before that. Changing the page keeps the
// previous page on screen until the new one arrives. The list answers
// `refreshSubsidyRecords` itself, because it may have to change page.
export function useSubsidyHistoryPage(
  identity: string | undefined,
  { page, pageSize }: { page: number; pageSize: number | undefined },
) {
  return useSubsidyQuery({
    identity,
    scope: `${HISTORY_PAGE_SCOPE}:${pageSize ?? 0}:${page}`,
    enabled: pageSize !== undefined,
    keepPreviousData: true,
    followRefresh: false,
    fetcher: (onekeyUserId) =>
      fetchSubsidyHistoryView({ page, limit: pageSize ?? 1, onekeyUserId }),
  });
}
