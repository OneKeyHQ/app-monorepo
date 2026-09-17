import type {
  IMarketTradingViewStorageNamespace,
  IMarketTradingViewSubIndicatorCountPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

export function normalizeMarketTradingViewSubIndicatorCountPersist(
  persistState: IMarketTradingViewSubIndicatorCountPersistAtom,
): IMarketTradingViewSubIndicatorCountPersistAtom {
  const count = persistState.subIndicatorCountByStorageNamespace?.market;
  const validCount =
    typeof count === 'number' && Number.isFinite(count) ? count : undefined;
  const stateKeys = Object.keys(persistState);
  const namespaceKeys = Object.keys(
    persistState.subIndicatorCountByStorageNamespace ?? {},
  );
  const hasExpectedShape =
    stateKeys.length === 1 &&
    stateKeys[0] === 'subIndicatorCountByStorageNamespace' &&
    namespaceKeys.every((key) => key === 'market') &&
    (namespaceKeys.length === 0 || validCount !== undefined);

  if (hasExpectedShape) {
    return persistState;
  }

  return {
    subIndicatorCountByStorageNamespace:
      validCount === undefined ? {} : { market: validCount },
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
    persistState.subIndicatorCountByStorageNamespace?.[storageNamespace];
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
  const normalizedPersistState =
    normalizeMarketTradingViewSubIndicatorCountPersist(persistState);
  if (
    normalizedPersistState.subIndicatorCountByStorageNamespace[
      storageNamespace
    ] === count
  ) {
    return normalizedPersistState;
  }

  return {
    subIndicatorCountByStorageNamespace: {
      [storageNamespace]: count,
    },
  };
}
