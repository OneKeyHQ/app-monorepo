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
  const hasNextAddressContextCache = Boolean(
    nextAddress &&
    (cachedPositionAddress === nextAddress ||
      cachedOpenOrdersAddress === nextAddress),
  );
  const hasAccountScopedContextCache = Boolean(
    cachedPositionAddress || cachedOpenOrdersAddress,
  );

  return {
    shouldClearActiveAccountData:
      (accountChanged && !hasNextAddressContextCache) ||
      (!nextAddress && hasAccountScopedContextCache),
    shouldClearTransientData: accountChanged && hasNextAddressContextCache,
  };
}
