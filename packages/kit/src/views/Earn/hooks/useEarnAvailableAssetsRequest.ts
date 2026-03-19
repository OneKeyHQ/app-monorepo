import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

let earnAvailableAssetsRequestSeed = 0;

// Keep a per-tab owner so stale responses can never rewrite the shared cache.
const latestEarnAvailableAssetsRequestByTab: Partial<
  Record<EAvailableAssetsTypeEnum, number>
> = {};

export function useEarnAvailableAssetsRequest({
  enabled,
  isStorageReady,
  refreshTrigger,
  tabType,
}: {
  enabled: boolean;
  isStorageReady: boolean;
  refreshTrigger: number;
  tabType?: EAvailableAssetsTypeEnum;
}) {
  const actions = useEarnActions();
  const [isFetching, setIsFetching] = useState(false);
  const currentRequestIdRef = useRef<number | undefined>(undefined);
  const hasSettledByTabRef = useRef<
    Partial<Record<EAvailableAssetsTypeEnum, boolean>>
  >({});
  const isHookMountedRef = useRef(true);

  const releaseRequest = useCallback(
    (targetTabType: EAvailableAssetsTypeEnum, requestId: number) => {
      if (currentRequestIdRef.current === requestId) {
        currentRequestIdRef.current = undefined;
        if (isHookMountedRef.current) {
          setIsFetching(false);
        }
      }

      if (latestEarnAvailableAssetsRequestByTab[targetTabType] !== requestId) {
        return;
      }

      delete latestEarnAvailableAssetsRequestByTab[targetTabType];
      actions.current.setLoadingState(
        `availableAssets-${targetTabType}`,
        false,
      );
    },
    [actions],
  );

  useEffect(() => {
    isHookMountedRef.current = true;

    return () => {
      isHookMountedRef.current = false;

      if (tabType && currentRequestIdRef.current) {
        releaseRequest(tabType, currentRequestIdRef.current);
      }
    };
  }, [releaseRequest, tabType]);

  useEffect(() => {
    if (!enabled || !isStorageReady || !tabType) {
      return;
    }

    const requestId = earnAvailableAssetsRequestSeed + 1;
    earnAvailableAssetsRequestSeed = requestId;
    currentRequestIdRef.current = requestId;
    latestEarnAvailableAssetsRequestByTab[tabType] = requestId;

    setIsFetching(true);
    actions.current.setLoadingState(`availableAssets-${tabType}`, true);

    let isCancelled = false;

    void (async () => {
      try {
        const nextAssets = await backgroundApiProxy.serviceStaking
          .getAvailableAssets({
            type: tabType,
          })
          .catch((error) => {
            console.error('Failed to fetch available assets:', error);
            throw error;
          });

        const isLatestRequest =
          latestEarnAvailableAssetsRequestByTab[tabType] === requestId;
        if (isCancelled || !isHookMountedRef.current || !isLatestRequest) {
          return;
        }

        hasSettledByTabRef.current[tabType] = true;
        actions.current.updateAvailableAssetsByType(tabType, nextAssets);
      } catch {
        const isLatestRequest =
          latestEarnAvailableAssetsRequestByTab[tabType] === requestId;
        if (isCancelled || !isHookMountedRef.current || !isLatestRequest) {
          return;
        }

        hasSettledByTabRef.current[tabType] = true;
      } finally {
        releaseRequest(tabType, requestId);
      }
    })();

    return () => {
      isCancelled = true;
      releaseRequest(tabType, requestId);
    };
  }, [
    actions,
    enabled,
    isStorageReady,
    refreshTrigger,
    releaseRequest,
    tabType,
  ]);

  return {
    hasSettled: tabType ? !!hasSettledByTabRef.current[tabType] : false,
    isFetching,
  };
}
