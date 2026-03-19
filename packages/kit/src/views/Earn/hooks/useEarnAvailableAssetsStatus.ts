import { useMemo } from 'react';

import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

export enum EAvailableAssetsMachineStatus {
  Booting = 'booting',
  InitialLoading = 'initial_loading',
  Refreshing = 'refreshing',
  Ready = 'ready',
  Empty = 'empty',
}

function getAvailableAssetsIdleStatus({
  cachedAssetsLength,
  hasSettled,
  isStorageReady,
}: {
  cachedAssetsLength: number;
  hasSettled: boolean;
  isStorageReady: boolean;
}) {
  if (!isStorageReady) {
    return cachedAssetsLength > 0
      ? EAvailableAssetsMachineStatus.Ready
      : EAvailableAssetsMachineStatus.Booting;
  }

  if (cachedAssetsLength > 0) {
    return EAvailableAssetsMachineStatus.Ready;
  }

  return hasSettled
    ? EAvailableAssetsMachineStatus.Empty
    : EAvailableAssetsMachineStatus.InitialLoading;
}

export function useEarnAvailableAssetsStatus({
  cachedAssetsLength,
  hasSettled,
  hasSharedCache,
  isFetching,
  isStorageReady,
  tabType,
}: {
  cachedAssetsLength: number;
  hasSettled: boolean;
  hasSharedCache: boolean;
  isFetching: boolean;
  isStorageReady: boolean;
  tabType?: EAvailableAssetsTypeEnum;
}) {
  return useMemo(() => {
    if (!tabType) {
      return EAvailableAssetsMachineStatus.Booting;
    }

    if (isFetching) {
      return cachedAssetsLength > 0
        ? EAvailableAssetsMachineStatus.Refreshing
        : EAvailableAssetsMachineStatus.InitialLoading;
    }

    return getAvailableAssetsIdleStatus({
      cachedAssetsLength,
      hasSettled: hasSettled || hasSharedCache,
      isStorageReady,
    });
  }, [
    cachedAssetsLength,
    hasSettled,
    hasSharedCache,
    isFetching,
    isStorageReady,
    tabType,
  ]);
}
