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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { closeModalPages } from '../../../hooks/usePageNavigation';

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
          const newParams = {
            ...params,
            fromExt: true,
          };
          await backgroundApiProxy.serviceApp.openExtensionExpandTab({
            path: `/onboarding/get-started`,
            params: newParams,
          });
          if (platformEnv.isExtensionUiSidePanel) {
            window.close();
          }
        } else {
          await closeModalPages();
          await timerUtils.wait(150);
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
