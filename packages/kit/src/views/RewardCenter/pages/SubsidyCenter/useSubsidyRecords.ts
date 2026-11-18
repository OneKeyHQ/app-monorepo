import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import {
  SUBSIDY_HISTORY_LIMIT,
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
  reload: () => void;
};

export type ISubsidyRecordListItem = ISubsidyRecordRow & {
  networkName: string;
};

export type ISubsidyHistoryView = {
  items: ISubsidyRecordListItem[];
  // A source failed, so the list may miss records. Not the same as empty.
  isPartial: boolean;
  // More records exist beyond the first page.
  hasMore: boolean;
};

// Loads once per signed-in identity. History and summary share a per-member
// rate limit on the server, so there is no polling and no refetch on focus;
// the only other trigger is an explicit reload.
function useSubsidyQuery<T>({
  identity,
  fetcher,
}: {
  identity: string | undefined;
  fetcher: () => Promise<T>;
}): ISubsidyQuery<T> {
  const [state, setState] = useState<{
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
  }>({ data: undefined, isLoading: Boolean(identity), isError: false });
  const requestRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    requestRef.current += 1;
    const request = requestRef.current;
    if (!identity) {
      setState({ data: undefined, isLoading: false, isError: false });
      return;
    }
    setState({ data: undefined, isLoading: true, isError: false });
    try {
      const data = await fetcherRef.current();
      if (requestRef.current === request) {
        setState({ data, isLoading: false, isError: false });
      }
    } catch {
      // The service already silenced the toast; the caller renders a retry.
      if (requestRef.current === request) {
        setState({ data: undefined, isLoading: false, isError: true });
      }
    }
  }, [identity]);

  useEffect(() => {
    void load();
    return () => {
      // Drop the response of a request that outlives its identity or page.
      requestRef.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, reload };
}

async function fetchSubsidySummaryView(): Promise<ISubsidySummaryView> {
  return buildSubsidySummaryView(
    await backgroundApiProxy.serviceGas.fetchSubsidySummary(),
  );
}

async function fetchSubsidyHistoryView(): Promise<ISubsidyHistoryView> {
  const history = await backgroundApiProxy.serviceGas.fetchSubsidyHistory({
    limit: SUBSIDY_HISTORY_LIMIT,
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
  return {
    items: rows.map((row) => ({
      ...row,
      networkName: networkNames[row.networkId] ?? row.networkId,
    })),
    isPartial: history?.complete === false,
    hasMore: Boolean(history?.nextCursor),
  };
}

// The signed-in OneKey ID the records belong to; undefined while signed out,
// which clears the data and sends nothing. Switching accounts reloads.
export function useSubsidyIdentity(): string | undefined {
  const { isLoggedIn, user } = useOneKeyAuth();
  if (!isLoggedIn) {
    return undefined;
  }
  return user?.onekeyUserId || 'signed-in';
}

export function useSubsidySummary(identity: string | undefined) {
  return useSubsidyQuery({ identity, fetcher: fetchSubsidySummaryView });
}

export function useSubsidyHistory(identity: string | undefined) {
  return useSubsidyQuery({ identity, fetcher: fetchSubsidyHistoryView });
}
