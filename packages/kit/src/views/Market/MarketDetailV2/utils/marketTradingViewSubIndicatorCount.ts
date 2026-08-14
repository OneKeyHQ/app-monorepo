import type {
  IMarketTradingViewStorageNamespace,
  IMarketTradingViewSubIndicatorCountPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

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
