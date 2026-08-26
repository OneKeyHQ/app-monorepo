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
  inFlight,
}: {
  riskLevel: EHostSecurityLevel;
  inFlight: boolean;
}): boolean {
  return !inFlight && isSiteScanRiskWarningLevel(riskLevel);
}
