import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import { shouldStartSiteScanRiskWarningAttempt } from './siteScanRiskWarning';

describe('shouldStartSiteScanRiskWarningAttempt', () => {
  it('starts only for High or Medium when no attempt is in flight', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.High,
        inFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Unknown,
        inFlight: false,
      }),
    ).toBe(false);
  });

  it('blocks re-entry while an attempt is in flight', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Medium,
        inFlight: true,
      }),
    ).toBe(false);
  });
});
