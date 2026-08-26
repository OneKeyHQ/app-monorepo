import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

export function isSiteScanRiskWarningLevel(
  riskLevel: EHostSecurityLevel,
): boolean {
  return (
    riskLevel === EHostSecurityLevel.High ||
    riskLevel === EHostSecurityLevel.Medium
  );
}

export function getSiteScanRiskWarningAccountKey(
  onekeyUserId: string | undefined,
): string {
  return onekeyUserId ?? '';
}

export function shouldStartSiteScanRiskWarningAttempt({
  riskLevel,
  sessionReportedUserId,
  currentUserId,
  instanceTrackedUserId,
  inFlight,
}: {
  riskLevel: EHostSecurityLevel;
  sessionReportedUserId: string | undefined;
  currentUserId?: string;
  instanceTrackedUserId?: string;
  inFlight: boolean;
}): boolean {
  if (inFlight) {
    return false;
  }
  if (currentUserId !== undefined) {
    const accountKey = getSiteScanRiskWarningAccountKey(currentUserId);
    if (
      sessionReportedUserId === accountKey ||
      instanceTrackedUserId === accountKey
    ) {
      return false;
    }
  }
  return isSiteScanRiskWarningLevel(riskLevel);
}

export function isPrimeActiveFromPersist(persist: {
  isLoggedIn?: boolean;
  isLoggedInOnServer?: boolean;
  primeSubscription?: { isActive?: boolean } | undefined;
}): boolean {
  return Boolean(
    persist.isLoggedIn &&
    persist.isLoggedInOnServer &&
    persist.primeSubscription?.isActive,
  );
}
