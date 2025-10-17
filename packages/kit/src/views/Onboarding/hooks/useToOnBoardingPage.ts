import { useMemo } from 'react';

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

        if (
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel
        ) {
          await backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: [
              ERootRoutes.Onboarding,
              EOnboardingV2Routes.OnboardingV2,
              EOnboardingPagesV2.GetStarted,
            ],
            params: {
              ...params,
              fromExt: true,
            },
          });
          if (platformEnv.isExtensionUiSidePanel) {
            window.close();
          }
        } else {
          navigation.navigate(ERootRoutes.Onboarding, {
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
