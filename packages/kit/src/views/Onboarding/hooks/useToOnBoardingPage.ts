import { useMemo } from 'react';

import { resetToRoute } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

export const isOnboardingFromExtensionUrl = () => {
  // eslint-disable-next-line unicorn/prefer-global-this
  if (platformEnv.isExtension && typeof window !== 'undefined') {
    return globalThis.location.hash.includes('fromExt=true');
  }
  return false;
};

export const useToOnBoardingPage = () => {
  const navigation = useAppNavigation();
  return useMemo(
    () =>
      async ({
        params,
      }: {
        isFullModal?: boolean;
        params?: IOnboardingParamList[EOnboardingPagesV2.GetStarted];
      } = {}) => {
        if (platformEnv.isWebDappMode) {
          navigation.pushModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.ConnectWalletOptions,
          });
          return;
        }

        // Check if onboarding is done to determine which page to navigate to
        const { isOnboardingDone } =
          await backgroundApiProxy.serviceOnboarding.isOnboardingDone();

        if (
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel
        ) {
          if (isOnboardingDone) {
            // Returning user - navigate to CreateOrImportWallet with fullOptions
            await backgroundApiProxy.serviceApp.openExtensionExpandTab({
              path: `/onboarding/CreateOrImportWallet`,
              params: { fullOptions: true },
            });
          } else {
            // First-time user - navigate to GetStarted
            const newParams = {
              ...params,
              fromExt: true,
            };
            await backgroundApiProxy.serviceApp.openExtensionExpandTab({
              path: `/onboarding/get-started`,
              params: newParams,
            });
          }
          if (platformEnv.isExtensionUiSidePanel) {
            window.close();
          }
        } else if (isOnboardingDone) {
          resetToRoute(ERootRoutes.Onboarding, {
            screen: EOnboardingV2Routes.OnboardingV2,
            params: {
              screen: EOnboardingPagesV2.CreateOrImportWallet,
              params: {
                fullOptions: true,
              },
            },
          });
        } else {
          // First-time user - navigate to GetStarted
          resetToRoute(ERootRoutes.Onboarding, {
            screen: EOnboardingV2Routes.OnboardingV2,
            params: {
              screen: EOnboardingPagesV2.GetStarted,
              params: {
                ...params,
              },
            },
          });
        }
      },
    [navigation],
  );
};

/**
 * TODO: Remove this hook and use the useNavigateToOnBoardingPage common hook instead
 */
export const useNavigateToPickYourDevicePage = () => {
  return useMemo(
    () => async () => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path: `/onboarding/${EOnboardingPagesV2.PickYourDevice}`,
        });
        if (platformEnv.isExtensionUiSidePanel) {
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
    [],
  );
};
