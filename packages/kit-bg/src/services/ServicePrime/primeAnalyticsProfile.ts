export type IPrimeAnalyticsProfileSnapshot = {
  isOneKeyIdLoggedIn: boolean;
  isPrimeActive: boolean;
  profileKey: string;
};

export function buildPrimeAnalyticsProfileSnapshot({
  isLoggedIn,
  isLoggedInOnServer,
  isPrimeSubscriptionActive,
}: {
  isLoggedIn: boolean | undefined;
  isLoggedInOnServer: boolean | undefined;
  isPrimeSubscriptionActive: boolean | undefined;
}): IPrimeAnalyticsProfileSnapshot {
  const isOneKeyIdLoggedIn = Boolean(isLoggedIn && isLoggedInOnServer);
  const isPrimeActive = Boolean(
    isOneKeyIdLoggedIn && isPrimeSubscriptionActive,
  );
  return {
    isOneKeyIdLoggedIn,
    isPrimeActive,
    profileKey: `${isOneKeyIdLoggedIn}:${isPrimeActive}`,
  };
}

export function shouldDropStalePrimeProfileReport({
  expectedKey,
  currentKey,
  lastHandledKey,
}: {
  expectedKey: string;
  currentKey: string;
  lastHandledKey: string | undefined;
}): { drop: boolean; clearLastHandled: boolean } {
  if (currentKey === expectedKey) {
    return { drop: false, clearLastHandled: false };
  }
  return {
    drop: true,
    clearLastHandled: lastHandledKey === expectedKey,
  };
}
