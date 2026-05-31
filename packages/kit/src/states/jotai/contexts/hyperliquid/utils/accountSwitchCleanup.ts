import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';

export { normalizePerpsAccountAddress };

export function getPerpsAccountSwitchCleanupPlan({
  previousAccountAddress,
  nextAccountAddress,
  cachedPositionAccountAddress,
  cachedOpenOrdersAccountAddress,
  cachedSpotOpenOrdersAccountAddress,
}: {
  previousAccountAddress?: string | null;
  nextAccountAddress?: string | null;
  cachedPositionAccountAddress?: string | null;
  cachedOpenOrdersAccountAddress?: string | null;
  cachedSpotOpenOrdersAccountAddress?: string | null;
}) {
  const previousAddress = normalizePerpsAccountAddress(previousAccountAddress);
  const nextAddress = normalizePerpsAccountAddress(nextAccountAddress);
  const cachedPositionAddress = normalizePerpsAccountAddress(
    cachedPositionAccountAddress,
  );
  const cachedOpenOrdersAddress = normalizePerpsAccountAddress(
    cachedOpenOrdersAccountAddress,
  );
  const cachedSpotOpenOrdersAddress = normalizePerpsAccountAddress(
    cachedSpotOpenOrdersAccountAddress,
  );
  const accountChanged = previousAddress !== nextAddress;
  const hasNextPositionCache = Boolean(
    nextAddress && cachedPositionAddress === nextAddress,
  );
  const hasNextOpenOrdersCache = Boolean(
    nextAddress && cachedOpenOrdersAddress === nextAddress,
  );
  const hasNextAddressContextCache = Boolean(
    hasNextPositionCache || hasNextOpenOrdersCache,
  );
  const hasAccountScopedContextCache = Boolean(
    cachedPositionAddress || cachedOpenOrdersAddress,
  );
  const shouldClearActiveAccountData =
    (accountChanged && !hasNextAddressContextCache) ||
    (!nextAddress && hasAccountScopedContextCache);
  const shouldClearScopedDataIndividually = Boolean(
    accountChanged &&
    hasNextAddressContextCache &&
    !shouldClearActiveAccountData,
  );

  return {
    shouldClearActiveAccountData,
    shouldClearPositionData: Boolean(
      shouldClearScopedDataIndividually &&
      cachedPositionAddress &&
      !hasNextPositionCache,
    ),
    shouldClearOpenOrdersData: Boolean(
      shouldClearScopedDataIndividually &&
      cachedOpenOrdersAddress &&
      !hasNextOpenOrdersCache,
    ),
    shouldClearSpotOpenOrdersData: Boolean(
      accountChanged &&
      !shouldClearActiveAccountData &&
      cachedSpotOpenOrdersAddress &&
      cachedSpotOpenOrdersAddress !== nextAddress,
    ),
    shouldClearTransientData: accountChanged && hasNextAddressContextCache,
  };
}
