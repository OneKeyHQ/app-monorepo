import { useMemo } from 'react';

import type { StackNavigationProp } from '@onekeyhq/components';
import { rootNavigationRef } from '@onekeyhq/components';
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

export const isOnboardingFromExtensionUrl = () => {
  // eslint-disable-next-line unicorn/prefer-global-this
  if (platformEnv.isExtension && typeof window !== 'undefined') {
    return globalThis.location.hash.includes('fromExt=true');
  }
  return false;
};

async function popToTop(navigation: ReturnType<typeof useAppNavigation>) {
  const state = rootNavigationRef.current?.getState();
  if (state?.routes?.length && state.routes.length > 1) {
    navigation.pop();
    await timerUtils.wait(350);
    const newState = rootNavigationRef.current?.getState();
    if (newState?.routes?.length && newState.routes.length > 1) {
      await popToTop(navigation);
    }
  }
  await timerUtils.wait(350);
}

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
          if (platformEnv.isNative) {
            await popToTop(navigation);
          }
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
