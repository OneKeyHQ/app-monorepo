import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import {
  isPrimeActiveFromPersist,
  shouldStartSiteScanRiskWarningAttempt,
} from './siteScanRiskWarning';

describe('shouldStartSiteScanRiskWarningAttempt', () => {
  it('starts only for High or Medium when no guard is set', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.High,
        sessionReported: false,
        instanceTracked: false,
        inFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Unknown,
        sessionReported: false,
        instanceTracked: false,
        inFlight: false,
      }),
    ).toBe(false);
  });

  it('blocks re-entry while an attempt is in flight', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Medium,
        sessionReported: false,
        instanceTracked: false,
        inFlight: true,
      }),
    ).toBe(false);
  });
});

describe('isPrimeActiveFromPersist', () => {
  it('requires login flags and an active subscription', () => {
    expect(
      isPrimeActiveFromPersist({
        isLoggedIn: true,
        isLoggedInOnServer: true,
        primeSubscription: { isActive: true },
      }),
    ).toBe(true);
    expect(
      isPrimeActiveFromPersist({
        isLoggedIn: false,
        isLoggedInOnServer: false,
        primeSubscription: { isActive: true },
      }),
    ).toBe(false);
  });
});
