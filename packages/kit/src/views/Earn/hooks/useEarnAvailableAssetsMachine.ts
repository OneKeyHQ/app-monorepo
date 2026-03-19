import { useMemo } from 'react';

import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import type {
  EAvailableAssetsTypeEnum,
  IEarnAvailableAsset,
} from '@onekeyhq/shared/types/earn';

import { useEarnAvailableAssetsRequest } from './useEarnAvailableAssetsRequest';
import {
  EAvailableAssetsMachineStatus,
  useEarnAvailableAssetsStatus,
} from './useEarnAvailableAssetsStatus';
import { useEarnAvailableAssetsVisibilityGate } from './useEarnAvailableAssetsVisibilityGate';

const EMPTY_ASSETS: IEarnAvailableAsset[] = [];

export function useEarnAvailableAssetsMachine({
  tabType,
}: {
  tabType?: EAvailableAssetsTypeEnum;
}) {
  const [{ availableAssetsByType = {}, refreshTrigger = 0, isMounted }] =
    useEarnAtom();
  const { canFetch } = useEarnAvailableAssetsVisibilityGate();

  const cachedAssets = useMemo(
    () =>
      tabType ? (availableAssetsByType[tabType] ?? EMPTY_ASSETS) : EMPTY_ASSETS,
    [availableAssetsByType, tabType],
  );

  const hasSharedCache = useMemo(
    () =>
      tabType
        ? Object.prototype.hasOwnProperty.call(availableAssetsByType, tabType)
        : false,
    [availableAssetsByType, tabType],
  );

  const { hasSettled, isFetching } = useEarnAvailableAssetsRequest({
    enabled: canFetch,
    isStorageReady: isMounted,
    refreshTrigger,
    tabType,
  });

  const status = useEarnAvailableAssetsStatus({
    cachedAssetsLength: cachedAssets.length,
    hasSettled,
    hasSharedCache,
    isFetching,
    isStorageReady: isMounted,
    tabType,
  });

  const isInitialLoading =
    status === EAvailableAssetsMachineStatus.Booting ||
    status === EAvailableAssetsMachineStatus.InitialLoading;

  return {
    assets: cachedAssets,
    isInitialLoading,
    isRefreshing: status === EAvailableAssetsMachineStatus.Refreshing,
    status,
  };
}
