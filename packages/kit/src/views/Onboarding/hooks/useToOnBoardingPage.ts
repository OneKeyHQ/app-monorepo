import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';

import { resetToRoute, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { enterOnboardingOrTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import {
  ONBOARDING_FROM_EXT_PARAM,
  ONBOARDING_GET_STARTED_PATH,
} from '@onekeyhq/shared/src/consts/onboardingConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSettingRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ONBOARDING_ROUTE_DISABLE_ANIMATION_PARAM,
} from '@onekeyhq/shared/src/routes';

export const isOnboardingFromExtensionUrl = () => {
  // eslint-disable-next-line unicorn/prefer-global-this
  if (platformEnv.isExtension && typeof window !== 'undefined') {
    return globalThis.location.hash.includes('fromExt=true');
  }
  return false;
};

function clearOnboardingDisableAnimationParam() {
  const rootState = rootNavigationRef.current?.getRootState();
  const onboardingRoute = rootState?.routes.find(
    (route) => route.name === ERootRoutes.Onboarding,
  );
  if (!onboardingRoute?.key) {
    return;
  }
  rootNavigationRef.current?.dispatch({
    ...CommonActions.setParams({
      [ONBOARDING_ROUTE_DISABLE_ANIMATION_PARAM]: undefined,
    }),
    source: onboardingRoute.key,
  });
}

export const useToOnBoardingPage = () => {
  const navigation = useAppNavigation();
  return useMemo(
    () => (options?: { disableAnimation?: boolean }) =>
      enterOnboardingOrTravelMode({
        enterOnboarding: async () => {
          if (platformEnv.isWebDappMode) {
            navigation.pushModal(EModalRoutes.OnboardingModal, {
              screen: EOnboardingPages.ConnectWalletOptions,
            });
            return;
          }

          if (
            platformEnv.isExtensionUiPopup ||
            platformEnv.isExtensionUiSidePanel ||
            platformEnv.isExtensionUiStandaloneWindow
          ) {
            await backgroundApiProxy.serviceApp.openExtensionExpandTab({
              path: ONBOARDING_GET_STARTED_PATH,
              params: ONBOARDING_FROM_EXT_PARAM,
            });
            if (
              platformEnv.isExtensionUiSidePanel ||
              platformEnv.isExtensionUiStandaloneWindow
            ) {
              window.close();
            }
          } else {
            resetToRoute(ERootRoutes.Onboarding, {
              screen: EOnboardingV2Routes.OnboardingV2,
              params: {
                screen: EOnboardingPagesV2.GetStarted,
              },
              // Read by the native onboarding screen options. `=== true`
              // keeps an onPress event passed as `options` from counting.
              ...(options?.disableAnimation === true
                ? { [ONBOARDING_ROUTE_DISABLE_ANIMATION_PARAM]: true }
                : undefined),
            });
            if (options?.disableAnimation === true) {
              // Only the entry skips the animation; leaving onboarding later
              // should still slide out. Wait until native has presented the
              // screen, or the option change could land in the same commit.
              setTimeout(clearOnboardingDisableAnimationParam, 600);
            }
          }
        },
        openTravelModeSettings: ({ admissionId }) => {
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingTravelModeModal,
            params: { admissionId },
          });
        },
      }),
    [navigation],
  );
};

/**
 * TODO: Remove this hook and use the useNavigateToOnBoardingPage common hook instead
 */
export const useNavigateToPickYourDevicePage = () => {
  const navigation = useAppNavigation();
  return useMemo(
    () => () =>
      enterOnboardingOrTravelMode({
        enterOnboarding: async () => {
          if (
            platformEnv.isExtensionUiPopup ||
            platformEnv.isExtensionUiSidePanel ||
            platformEnv.isExtensionUiStandaloneWindow
          ) {
            await backgroundApiProxy.serviceApp.openExtensionExpandTab({
              path: `/onboarding/${EOnboardingPagesV2.PickYourDevice}`,
            });
            if (
              platformEnv.isExtensionUiSidePanel ||
              platformEnv.isExtensionUiStandaloneWindow
            ) {
              window.close();
            }
          } else {
            resetToRoute(ERootRoutes.Onboarding, {
              screen: EOnboardingV2Routes.OnboardingV2,
              params: {
                screen: EOnboardingPagesV2.PickYourDevice,
              },
            });
          }
        },
        openTravelModeSettings: ({ admissionId }) => {
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingTravelModeModal,
            params: { admissionId },
          });
        },
      }),
    [navigation],
  );
};
