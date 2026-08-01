import { isPro2DebugModuleEnabled, isPro2TestModeEnabled } from './devSettings';

describe('isPro2TestModeEnabled', () => {
  it('requires both global dev settings and the Pro 2 test switch', () => {
    expect(
      isPro2TestModeEnabled({
        enabled: true,
        settings: { enablePro2TestMode: true },
      }),
    ).toBe(true);
    expect(
      isPro2TestModeEnabled({
        enabled: false,
        settings: { enablePro2TestMode: true },
      }),
    ).toBe(false);
    expect(
      isPro2TestModeEnabled({
        enabled: true,
        settings: { enablePro2TestMode: false },
      }),
    ).toBe(false);
  });
});

describe('isPro2DebugModuleEnabled', () => {
  it('requires an explicit switch for each Pro 2 debug module', () => {
    const devSettings = {
      enabled: true,
      settings: {
        enablePro2TestMode: true,
        enablePro2OnboardingDev: true,
        enablePortfolioSyncDev: false,
      },
    } as const;

    expect(isPro2DebugModuleEnabled(devSettings, 'onboarding')).toBe(true);
    expect(isPro2DebugModuleEnabled(devSettings, 'portfolio')).toBe(false);
  });

  it('does not enable child modules from the master switch alone', () => {
    const devSettings = {
      enabled: true,
      settings: { enablePro2TestMode: true },
    } as const;

    expect(isPro2DebugModuleEnabled(devSettings, 'onboarding')).toBe(false);
    expect(isPro2DebugModuleEnabled(devSettings, 'portfolio')).toBe(false);
  });
});
