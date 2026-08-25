import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

export function isSiteScanRiskWarningLevel(
  riskLevel: EHostSecurityLevel,
): boolean {
  return (
    riskLevel === EHostSecurityLevel.High ||
    riskLevel === EHostSecurityLevel.Medium
  );
}

export function shouldStartSiteScanRiskWarningAttempt({
  riskLevel,
  sessionReported,
  instanceTracked,
  inFlight,
}: {
  riskLevel: EHostSecurityLevel;
  sessionReported: boolean;
  instanceTracked: boolean;
  inFlight: boolean;
}): boolean {
  if (sessionReported || instanceTracked || inFlight) {
    return false;
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
