import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

const siteScanRiskWarnedReportedUserIds = new Set<string>();

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
  inFlight,
}: {
  riskLevel: EHostSecurityLevel;
  inFlight: boolean;
}): boolean {
  return !inFlight && isSiteScanRiskWarningLevel(riskLevel);
}

export function shouldReportSiteScanRiskWarnedForUser(
  onekeyUserId: string | undefined,
): boolean {
  if (!onekeyUserId || siteScanRiskWarnedReportedUserIds.has(onekeyUserId)) {
    return false;
  }
  siteScanRiskWarnedReportedUserIds.add(onekeyUserId);
  return true;
}

export function resetSiteScanRiskWarningSessionForTests() {
  siteScanRiskWarnedReportedUserIds.clear();
}
