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
        sessionReportedUserId: undefined,
        inFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Unknown,
        sessionReportedUserId: undefined,
        inFlight: false,
      }),
    ).toBe(false);
  });

  it('blocks re-entry while an attempt is in flight', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.Medium,
        sessionReportedUserId: undefined,
        inFlight: true,
      }),
    ).toBe(false);
  });

  it('blocks the same account but allows another account in the same session', () => {
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.High,
        sessionReportedUserId: 'user-a',
        currentUserId: 'user-a',
        inFlight: false,
      }),
    ).toBe(false);
    expect(
      shouldStartSiteScanRiskWarningAttempt({
        riskLevel: EHostSecurityLevel.High,
        sessionReportedUserId: 'user-a',
        currentUserId: 'user-b',
        inFlight: false,
      }),
    ).toBe(true);
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
