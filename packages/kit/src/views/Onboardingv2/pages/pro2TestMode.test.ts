import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  getOnboardingConnectProtocol,
  shouldShowPro2OnboardingEntry,
} from './pro2TestMode';

describe('Pro 2 onboarding test mode', () => {
  const enabledDevSettings = {
    enabled: true,
    settings: {
      enablePro2OnboardingDev: true,
      enablePro2TestMode: true,
    },
  } as const;

  it('shows the Pro 2 entry only while its explicit test mode is enabled', () => {
    expect(shouldShowPro2OnboardingEntry(enabledDevSettings)).toBe(true);
    expect(
      shouldShowPro2OnboardingEntry({
        enabled: true,
        settings: {
          enablePro2OnboardingDev: true,
          enablePro2TestMode: false,
        },
      }),
    ).toBe(false);
    expect(
      shouldShowPro2OnboardingEntry({
        enabled: true,
        settings: { enablePro2TestMode: true },
      }),
    ).toBe(false);
  });

  it('forces Protocol V2 only for an explicitly selected Pro 2 flow', () => {
    expect(
      getOnboardingConnectProtocol({
        deviceTypeItems: [EDeviceType.Pro2],
        devSettings: enabledDevSettings,
      }),
    ).toBe('V2');
    expect(
      getOnboardingConnectProtocol({
        deviceTypeItems: [EDeviceType.Pro],
        devSettings: enabledDevSettings,
      }),
    ).toBeUndefined();
    expect(
      getOnboardingConnectProtocol({
        deviceTypeItems: [EDeviceType.Pro2],
        devSettings: {
          enabled: true,
          settings: {
            enablePro2OnboardingDev: true,
            enablePro2TestMode: false,
          },
        },
      }),
    ).toBeUndefined();
  });
});
