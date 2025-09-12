import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EOnboardingPages,
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
        isFullModal = false,
        params,
      }: {
        isFullModal?: boolean;
        params?: IOnboardingParamList[EOnboardingPages.GetStarted];
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
              isFullModal ? ERootRoutes.iOSFullScreen : ERootRoutes.Modal,
              EModalRoutes.OnboardingModal,
              EOnboardingPages.GetStarted,
            ],
            params: {
              ...params,
              isFullModal,
              fromExt: true,
            },
          });
          if (platformEnv.isExtensionUiSidePanel) {
            window.close();
          }
        } else {
          navigation[isFullModal ? 'pushFullModal' : 'pushModal'](
            EModalRoutes.OnboardingModal,
            {
              screen: EOnboardingPages.GetStarted,
              params: {
                ...params,
                isFullModal,
              },
            },
          );
        }
      },
    [navigation],
  );
};
