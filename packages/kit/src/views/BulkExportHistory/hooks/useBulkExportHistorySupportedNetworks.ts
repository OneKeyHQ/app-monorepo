import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBulkExportHistorySupportedNetworksPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IAccountTransactionRange,
  IFetchAccountTransactionRangeResp,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function resolveDefaultSelectedNetworkIds({
  homeNetworkId,
  supportedNetworkIds,
  allNetworkEnabledNetworkIds,
}: {
  homeNetworkId?: string;
  supportedNetworkIds: string[];
  allNetworkEnabledNetworkIds?: string[];
}) {
  const networkIdsMap = getNetworkIdsMap();

  if (!supportedNetworkIds.length) {
    return [];
  }

  // When coming from all-networks mode, select the intersection of
  // enabled networks and supported export networks
  if (
    networkUtils.isAllNetwork({ networkId: homeNetworkId }) &&
    allNetworkEnabledNetworkIds
  ) {
    const supportedSet = new Set(supportedNetworkIds);
    const matched = allNetworkEnabledNetworkIds.filter((id) =>
      supportedSet.has(id),
    );
    if (matched.length > 0) {
      return matched;
    }
    // Fallback to eth if no overlap
    if (supportedNetworkIds.includes(networkIdsMap.eth)) {
      return [networkIdsMap.eth];
    }
    return [supportedNetworkIds[0]];
  }

  if (homeNetworkId && supportedNetworkIds.includes(homeNetworkId)) {
    return [homeNetworkId];
  }

  if (supportedNetworkIds.includes(networkIdsMap.eth)) {
    return [networkIdsMap.eth];
  }

  return [supportedNetworkIds[0]];
}

export function useBulkExportHistorySupportedNetworks({
  homeNetworkId,
}: {
  homeNetworkId?: string;
}) {
  const [cachedSupportedNetworkIds, setCachedSupportedNetworkIds] =
    useBulkExportHistorySupportedNetworksPersistAtom();
  const [rangeResp, setRangeResp] =
    useState<IFetchAccountTransactionRangeResp>();
  const [isRangeLoading, setIsRangeLoading] = useState(true);
  const [isRangeRequestFinished, setIsRangeRequestFinished] = useState(false);
  const [selectedNetworkIdsState, setSelectedNetworkIdsState] = useState<
    string[]
  >([]);

  const selectionInitializedRef = useRef(false);
  const selectionDirtyRef = useRef(false);

  const isAllNetworkHome = networkUtils.isAllNetwork({
    networkId: homeNetworkId,
  });
  const [allNetworkEnabledNetworkIds, setAllNetworkEnabledNetworkIds] =
    useState<string[] | undefined>(undefined);

  useEffect(() => {
    if (!isAllNetworkHome) return;
    let cancelled = false;
    void (async () => {
      try {
        const state =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        if (!cancelled) {
          setAllNetworkEnabledNetworkIds(
            Object.keys(state.enabledNetworks ?? {}),
          );
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAllNetworkHome]);

  const fallbackSupportedNetworkIds = useMemo(
    () => networkUtils.getEnabledExportHistoryNetworkIds(),
    [],
  );

  const apiSupportedNetworkIds = useMemo(
    () => Object.keys(rangeResp?.networkMap ?? {}),
    [rangeResp?.networkMap],
  );

  const supportedNetworkIds = useMemo(() => {
    if (apiSupportedNetworkIds.length > 0) {
      return apiSupportedNetworkIds;
    }

    if (cachedSupportedNetworkIds.length > 0) {
      return cachedSupportedNetworkIds;
    }

    if (isRangeRequestFinished) {
      return fallbackSupportedNetworkIds;
    }

    return [];
  }, [
    apiSupportedNetworkIds,
    cachedSupportedNetworkIds,
    fallbackSupportedNetworkIds,
    isRangeRequestFinished,
  ]);

  useEffect(() => {
    let cancelled = false;

    const fetchRange = async () => {
      setIsRangeLoading(true);

      try {
        const resp =
          await backgroundApiProxy.serviceHistory.fetchAccountTransactionRange();
        if (cancelled) {
          return;
        }

        setRangeResp(resp);

        const nextSupportedNetworkIds = Object.keys(resp.networkMap ?? {});
        if (nextSupportedNetworkIds.length > 0) {
          setCachedSupportedNetworkIds(nextSupportedNetworkIds);
        }
      } catch {
        // Ignore range request errors and fall back to cache or static ids.
      } finally {
        if (!cancelled) {
          setIsRangeLoading(false);
          setIsRangeRequestFinished(true);
        }
      }
    };

    void fetchRange();

    return () => {
      cancelled = true;
    };
  }, [setCachedSupportedNetworkIds]);

  const setSelectedNetworkIds = useCallback(
    (networkIds: string[]) => {
      const supportedNetworkIdSet = new Set(supportedNetworkIds);
      const nextSelectedNetworkIds = Array.from(new Set(networkIds)).filter(
        (networkId) => supportedNetworkIdSet.has(networkId),
      );

      setSelectedNetworkIdsState((prev) => {
        const nextValue =
          nextSelectedNetworkIds.length > 0
            ? nextSelectedNetworkIds
            : resolveDefaultSelectedNetworkIds({
                homeNetworkId,
                supportedNetworkIds,
                allNetworkEnabledNetworkIds,
              });

        const isChanged =
          prev.length !== nextValue.length ||
          prev.some((networkId, index) => networkId !== nextValue[index]);

        if (isChanged) {
          selectionDirtyRef.current = true;
        }

        return nextValue;
      });
    },
    [homeNetworkId, supportedNetworkIds, allNetworkEnabledNetworkIds],
  );

  useEffect(() => {
    if (!supportedNetworkIds.length) {
      return;
    }

    const supportedNetworkIdSet = new Set(supportedNetworkIds);
    const nextDefaultSelectedNetworkIds = resolveDefaultSelectedNetworkIds({
      homeNetworkId,
      supportedNetworkIds,
      allNetworkEnabledNetworkIds,
    });

    setSelectedNetworkIdsState((prev) => {
      if (!selectionInitializedRef.current) {
        selectionInitializedRef.current = true;
        return nextDefaultSelectedNetworkIds;
      }

      if (!selectionDirtyRef.current) {
        return nextDefaultSelectedNetworkIds;
      }

      const nextSelectedNetworkIds = prev.filter((networkId) =>
        supportedNetworkIdSet.has(networkId),
      );

      if (nextSelectedNetworkIds.length > 0) {
        return nextSelectedNetworkIds;
      }

      return nextDefaultSelectedNetworkIds;
    });
  }, [homeNetworkId, supportedNetworkIds, allNetworkEnabledNetworkIds]);

  const selectedRangeMap = useMemo(() => {
    const networkMap = rangeResp?.networkMap;

    if (!networkMap || !selectedNetworkIdsState.length) {
      return undefined;
    }

    const nextSelectedRangeMap: Record<string, IAccountTransactionRange> = {};

    for (const networkId of selectedNetworkIdsState) {
      const range = networkMap[networkId];
      if (!range) {
        return undefined;
      }
      nextSelectedRangeMap[networkId] = range;
    }

    return nextSelectedRangeMap;
  }, [rangeResp?.networkMap, selectedNetworkIdsState]);

  const effectiveRange = useMemo(() => {
    if (!selectedRangeMap) {
      return undefined;
    }

    const ranges = Object.values(selectedRangeMap);
    if (!ranges.length) {
      return undefined;
    }

    return {
      minTimestampMs: Math.min(...ranges.map((range) => range.minTimestampMs)),
      maxTimestampMs: Math.max(...ranges.map((range) => range.maxTimestampMs)),
    };
  }, [selectedRangeMap]);

  return {
    supportedNetworkIds,
    selectedNetworkIds: selectedNetworkIdsState,
    setSelectedNetworkIds,
    networkRangeMap: rangeResp?.networkMap,
    selectedRangeMap,
    effectiveRange,
    hasRangeData: Boolean(selectedRangeMap && effectiveRange),
    isLoading: supportedNetworkIds.length === 0,
    isRangeLoading,
  };
}
