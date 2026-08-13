import type {
  IMarketTradingViewStorageNamespace,
  IMarketTradingViewSubIndicatorCountPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

export function getMarketTradingViewStorageNamespace({
  chartKey,
  detectedStorageNamespace,
  isSourceLoading,
  persistState,
}: {
  chartKey: string;
  detectedStorageNamespace: IMarketTradingViewStorageNamespace;
  isSourceLoading: boolean;
  persistState: IMarketTradingViewSubIndicatorCountPersistAtom;
}) {
  if (isSourceLoading) {
    return persistState.storageNamespaceByChartKey[chartKey] ?? 'market';
  }

  return detectedStorageNamespace;
}

export function setMarketTradingViewStorageNamespace({
  chartKey,
  persistState,
  storageNamespace,
}: {
  chartKey: string;
  persistState: IMarketTradingViewSubIndicatorCountPersistAtom;
  storageNamespace: IMarketTradingViewStorageNamespace;
}) {
  const currentStorageNamespace =
    persistState.storageNamespaceByChartKey[chartKey];
  if (
    currentStorageNamespace === storageNamespace ||
    (storageNamespace === 'market' && currentStorageNamespace === undefined)
  ) {
    return persistState;
  }

  const storageNamespaceByChartKey = {
    ...persistState.storageNamespaceByChartKey,
  };
  if (storageNamespace === 'market') {
    delete storageNamespaceByChartKey[chartKey];
  } else {
    storageNamespaceByChartKey[chartKey] = storageNamespace;
  }

  return {
    ...persistState,
    storageNamespaceByChartKey,
  };
}

export function getMarketTradingViewSubIndicatorCount({
  persistState,
  storageNamespace,
}: {
  persistState: IMarketTradingViewSubIndicatorCountPersistAtom;
  storageNamespace: IMarketTradingViewStorageNamespace;
}) {
  const count =
    persistState.subIndicatorCountByStorageNamespace[storageNamespace];
  return typeof count === 'number' && Number.isFinite(count)
    ? count
    : undefined;
}

export function setMarketTradingViewSubIndicatorCount({
  count,
  persistState,
  storageNamespace,
}: {
  count: number;
  persistState: IMarketTradingViewSubIndicatorCountPersistAtom;
  storageNamespace: IMarketTradingViewStorageNamespace;
}) {
  if (
    persistState.subIndicatorCountByStorageNamespace[storageNamespace] === count
  ) {
    return persistState;
  }

  return {
    ...persistState,
    subIndicatorCountByStorageNamespace: {
      ...persistState.subIndicatorCountByStorageNamespace,
      [storageNamespace]: count,
    },
  };
}
