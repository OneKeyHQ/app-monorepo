import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import {
  resetSiteScanRiskWarningSessionForTests,
  shouldReportSiteScanRiskWarnedForUser,
  shouldStartSiteScanRiskWarningAttempt,
} from './siteScanRiskWarning';

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

describe('shouldReportSiteScanRiskWarnedForUser', () => {
  beforeEach(() => {
    resetSiteScanRiskWarningSessionForTests();
  });

  it('reports each OneKey account once per session', () => {
    expect(shouldReportSiteScanRiskWarnedForUser('user-a')).toBe(true);
    expect(shouldReportSiteScanRiskWarnedForUser('user-a')).toBe(false);
    expect(shouldReportSiteScanRiskWarnedForUser('user-b')).toBe(true);
    expect(shouldReportSiteScanRiskWarnedForUser('user-a')).toBe(false);
  });

  it('skips an empty user id', () => {
    expect(shouldReportSiteScanRiskWarnedForUser(undefined)).toBe(false);
    expect(shouldReportSiteScanRiskWarnedForUser('')).toBe(false);
  });
});
