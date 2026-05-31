export function normalizePerpsAccountAddress(address?: string | null) {
  return address?.toLowerCase() ?? null;
}

export function getPerpsAccountSwitchCleanupPlan({
  previousAccountAddress,
  nextAccountAddress,
  cachedPositionAccountAddress,
  cachedOpenOrdersAccountAddress,
}: {
  previousAccountAddress?: string | null;
  nextAccountAddress?: string | null;
  cachedPositionAccountAddress?: string | null;
  cachedOpenOrdersAccountAddress?: string | null;
}) {
  const previousAddress = normalizePerpsAccountAddress(previousAccountAddress);
  const nextAddress = normalizePerpsAccountAddress(nextAccountAddress);
  const cachedPositionAddress = normalizePerpsAccountAddress(
    cachedPositionAccountAddress,
  );
  const cachedOpenOrdersAddress = normalizePerpsAccountAddress(
    cachedOpenOrdersAccountAddress,
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
    shouldClearSpotOpenOrdersData: shouldClearScopedDataIndividually,
    shouldClearTransientData: accountChanged && hasNextAddressContextCache,
  };
}
