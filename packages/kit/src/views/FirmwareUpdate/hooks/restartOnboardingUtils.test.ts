import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';

import { buildFirmwareUpdateOnboardingParams } from './restartOnboardingUtils';

describe('buildFirmwareUpdateOnboardingParams', () => {
  it('returns to device selection when firmware metadata has no device type', () => {
    expect(buildFirmwareUpdateOnboardingParams(undefined)).toEqual({
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.PickYourDevice,
      },
    });
  });

  it('continues to device connection when firmware metadata has a device type', () => {
    expect(buildFirmwareUpdateOnboardingParams(EDeviceType.Pro)).toEqual({
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.ConnectYourDevice,
        params: {
          deviceType: [EDeviceType.Pro],
        },
      },
    });
  });
});
