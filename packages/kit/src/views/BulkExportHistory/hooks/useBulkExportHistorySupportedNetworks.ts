import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBulkExportHistorySupportedNetworksPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IAccountTransactionRange,
  IFetchAccountTransactionRangeResp,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { resolveDefaultSelectedNetworkIds } from '../utils/resolveDefaultSelectedNetworkIds';

import type { IBulkExportHistoryAccountNetworkCompatibility } from '../utils/bulkExportHistoryAccountUtils';

export function useBulkExportHistorySupportedNetworks({
  homeNetworkId,
  initialSelectedNetworkIds,
  accountNetworkCompatibility,
}: {
  homeNetworkId?: string;
  initialSelectedNetworkIds?: string[];
  accountNetworkCompatibility?: IBulkExportHistoryAccountNetworkCompatibility;
}) {
  const [cachedSupportedNetworkIds, setCachedSupportedNetworkIds] =
    useBulkExportHistorySupportedNetworksPersistAtom();
  const [rangeResp, setRangeResp] =
    useState<IFetchAccountTransactionRangeResp>();
  const [isRangeLoading, setIsRangeLoading] = useState(true);
  const [hasRangeError, setHasRangeError] = useState(false);
  const [isRangeRequestFinished, setIsRangeRequestFinished] = useState(false);
  // Bumped by retryRangeRequest; keyed into both the range request effect and
  // the network-compatibility scope so a single retry refreshes both fetches.
  const [requestVersion, setRequestVersion] = useState(0);
  const [networkCompatibilityResult, setNetworkCompatibilityResult] = useState<{
    scope: string;
    networkIds: string[];
    hasError: boolean;
  }>();
  const [selectedNetworkIdsState, setSelectedNetworkIdsState] = useState<
    string[]
  >([]);

  const selectionInitializedRef = useRef(false);
  const selectionDirtyRef = useRef(false);

  const fallbackSupportedNetworkIds = useMemo(
    () => networkUtils.getEnabledExportHistoryNetworkIds(),
    [],
  );

  const apiSupportedNetworkIds = useMemo(
    () => Object.keys(rangeResp ?? {}),
    [rangeResp],
  );
  const hasEmptyRange = Boolean(
    isRangeRequestFinished &&
    !hasRangeError &&
    rangeResp &&
    apiSupportedNetworkIds.length === 0,
  );

  const unfilteredSupportedNetworkIds = useMemo(() => {
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

  const unfilteredSupportedNetworkIdsKey = JSON.stringify(
    unfilteredSupportedNetworkIds,
  );
  const accountIdForNetworkCompatibility =
    accountNetworkCompatibility?.accountId;
  const walletIdForNetworkCompatibility = accountNetworkCompatibility?.walletId;
  let networkCompatibilityIdentity: string | undefined;
  if (accountIdForNetworkCompatibility) {
    networkCompatibilityIdentity = `account:${accountIdForNetworkCompatibility}`;
  } else if (walletIdForNetworkCompatibility) {
    networkCompatibilityIdentity = `wallet:${walletIdForNetworkCompatibility}`;
  }
  const networkCompatibilityScope = networkCompatibilityIdentity
    ? `${networkCompatibilityIdentity}:${unfilteredSupportedNetworkIdsKey}:${requestVersion}`
    : undefined;

  useEffect(() => {
    if (!networkCompatibilityIdentity || !networkCompatibilityScope) {
      return;
    }

    let cancelled = false;
    const networkIds = JSON.parse(unfilteredSupportedNetworkIdsKey) as string[];

    const fetchCompatibleNetworkIds = async () => {
      if (!networkIds.length) {
        setNetworkCompatibilityResult({
          scope: networkCompatibilityScope,
          networkIds: [],
          hasError: false,
        });
        return;
      }

      try {
        const { mainnetItems, testnetItems } =
          await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            {
              accountId: accountIdForNetworkCompatibility,
              walletId: walletIdForNetworkCompatibility,
              networkIds,
              excludeTestNetwork: false,
            },
          );
        if (cancelled) {
          return;
        }

        const compatibleNetworkIdSet = new Set(
          [...mainnetItems, ...testnetItems].map((network) => network.id),
        );
        setNetworkCompatibilityResult({
          scope: networkCompatibilityScope,
          networkIds: networkIds.filter((networkId) =>
            compatibleNetworkIdSet.has(networkId),
          ),
          hasError: false,
        });
      } catch {
        if (!cancelled) {
          setNetworkCompatibilityResult({
            scope: networkCompatibilityScope,
            networkIds: [],
            hasError: true,
          });
        }
      }
    };

    void fetchCompatibleNetworkIds();

    return () => {
      cancelled = true;
    };
  }, [
    accountIdForNetworkCompatibility,
    networkCompatibilityScope,
    networkCompatibilityIdentity,
    unfilteredSupportedNetworkIdsKey,
    walletIdForNetworkCompatibility,
  ]);

  const currentNetworkCompatibilityResult =
    networkCompatibilityResult?.scope === networkCompatibilityScope
      ? networkCompatibilityResult
      : undefined;
  const isNetworkCompatibilityReady = Boolean(
    !networkCompatibilityIdentity || currentNetworkCompatibilityResult,
  );
  const hasNetworkCompatibilityError = Boolean(
    networkCompatibilityIdentity &&
    isNetworkCompatibilityReady &&
    currentNetworkCompatibilityResult?.hasError,
  );
  const supportedNetworkIds = useMemo(() => {
    if (!networkCompatibilityIdentity) {
      return unfilteredSupportedNetworkIds;
    }
    if (
      !currentNetworkCompatibilityResult ||
      currentNetworkCompatibilityResult.hasError
    ) {
      return [];
    }
    return currentNetworkCompatibilityResult.networkIds;
  }, [
    currentNetworkCompatibilityResult,
    networkCompatibilityIdentity,
    unfilteredSupportedNetworkIds,
  ]);

  useEffect(() => {
    let cancelled = false;

    const fetchRange = async () => {
      setIsRangeLoading(true);
      setHasRangeError(false);

      try {
        const resp =
          await backgroundApiProxy.serviceHistory.fetchAccountTransactionRange();
        if (cancelled) {
          return;
        }

        setRangeResp(resp);

        const nextSupportedNetworkIds = Object.keys(resp ?? {});
        if (nextSupportedNetworkIds.length > 0) {
          setCachedSupportedNetworkIds(nextSupportedNetworkIds);
        }
      } catch {
        if (!cancelled) {
          setHasRangeError(true);
        }
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
  }, [requestVersion, setCachedSupportedNetworkIds]);

  const retryRangeRequest = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

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
                initialSelectedNetworkIds,
                supportedNetworkIds,
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
    [homeNetworkId, initialSelectedNetworkIds, supportedNetworkIds],
  );

  useEffect(() => {
    if (!isNetworkCompatibilityReady) {
      return;
    }

    if (!supportedNetworkIds.length) {
      setSelectedNetworkIdsState([]);
      return;
    }

    const supportedNetworkIdSet = new Set(supportedNetworkIds);
    const nextDefaultSelectedNetworkIds = resolveDefaultSelectedNetworkIds({
      homeNetworkId,
      initialSelectedNetworkIds,
      supportedNetworkIds,
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
  }, [
    homeNetworkId,
    initialSelectedNetworkIds,
    supportedNetworkIds,
    isNetworkCompatibilityReady,
  ]);

  const selectedRangeMap = useMemo(() => {
    if (!rangeResp || !selectedNetworkIdsState.length) {
      return undefined;
    }

    const nextSelectedRangeMap: Record<string, IAccountTransactionRange> = {};
    const supportedNetworkIdSet = new Set(supportedNetworkIds);

    for (const networkId of selectedNetworkIdsState) {
      if (!supportedNetworkIdSet.has(networkId)) {
        return undefined;
      }
      const range = rangeResp[networkId];
      if (!range) {
        return undefined;
      }
      nextSelectedRangeMap[networkId] = range;
    }

    return nextSelectedRangeMap;
  }, [rangeResp, selectedNetworkIdsState, supportedNetworkIds]);

  const effectiveRange = useMemo(() => {
    if (!selectedRangeMap) {
      return undefined;
    }

    const ranges = Object.values(selectedRangeMap);
    if (!ranges.length) {
      return undefined;
    }

    // Intersection (latest start, earliest end): the export window must be
    // supported by EVERY selected network. Returns undefined when the selected
    // networks share no overlapping window, which disables exporting.
    const minTimestampMs = Math.max(
      ...ranges.map((range) => range.minTimestampMs),
    );
    const maxTimestampMs = Math.min(
      ...ranges.map((range) => range.maxTimestampMs),
    );

    if (minTimestampMs >= maxTimestampMs) {
      return undefined;
    }

    return { minTimestampMs, maxTimestampMs };
  }, [selectedRangeMap]);

  return {
    supportedNetworkIds,
    selectedNetworkIds: selectedNetworkIdsState,
    setSelectedNetworkIds,
    networkRangeMap: rangeResp,
    selectedRangeMap,
    effectiveRange,
    hasRangeData: Boolean(selectedRangeMap && effectiveRange),
    isLoading:
      (!isRangeRequestFinished && unfilteredSupportedNetworkIds.length === 0) ||
      (isRangeLoading && !rangeResp) ||
      !isNetworkCompatibilityReady,
    isRangeLoading,
    hasRangeError:
      (hasRangeError && !rangeResp) || hasNetworkCompatibilityError,
    hasEmptyRange,
    retryRangeRequest,
  };
}
