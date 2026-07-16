import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';

import type { EDeviceType } from '@onekeyfe/hd-shared';

export const buildFirmwareUpdateOnboardingParams = (
  deviceType: EDeviceType | undefined,
) => ({
  screen: EOnboardingV2Routes.OnboardingV2,
  params: deviceType
    ? {
        screen: EOnboardingPagesV2.ConnectYourDevice,
        params: {
          deviceType: [deviceType],
        },
      }
    : {
        screen: EOnboardingPagesV2.PickYourDevice,
      },
});
