import { useCallback, useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { HomeRoutes, RootRoutes } from '../routes/types';
import { setHomePageCheckBoarding } from '../store/reducers/data';
import { setOnBoardingLoadingBehindModal } from '../store/reducers/runtime';
import { wait } from '../utils/helper';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';

import { useAppSelector } from './redux';
import useAppNavigation from './useAppNavigation';
import useNavigation from './useNavigation';
import { useNavigationActions } from './useNavigationActions';

import type { ModalScreenProps, RootRoutesParams } from '../routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

export function closeExtensionWindowIfOnboardingFinished() {
  if (platformEnv.isExtensionUiStandaloneWindow) {
    window?.close?.();
  }
}

export const useOnboardingRequired = (isHomeCheck?: boolean) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  const homePageCheckBoarding = useAppSelector(
    (s) => s.data.homePageCheckBoarding,
  );
  useEffect(() => {
    if (!boardingCompleted) {
      if (!isHomeCheck || (isHomeCheck && !homePageCheckBoarding)) {
        if (isHomeCheck) {
          backgroundApiProxy.dispatch(setHomePageCheckBoarding());
        }
        navigation.replace(RootRoutes.Onboarding, {
          screen: EOnboardingRoutes.Welcome,
          params: { disableAnimation: !!isHomeCheck },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export function useOnboardingDone() {
  // TODO should set s.status.boardingCompleted=true ?
  const { closeWalletSelector, openRootHome } = useNavigationActions();
  const onboardingDone = useCallback(
    async ({
      delay = 150,
      showOnBoardingLoading,
    }: { delay?: number; showOnBoardingLoading?: boolean } = {}) => {
      if (showOnBoardingLoading) {
        backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(true));
        await wait(100);
      }

      closeWalletSelector();
      await wait(delay);
      openRootHome();
      await wait(delay);
      closeExtensionWindowIfOnboardingFinished();

      if (showOnBoardingLoading) {
        await wait(600);
        backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
      }
    },
    [closeWalletSelector, openRootHome],
  );
  return onboardingDone;
}

export function useNavigateToOnboarding() {
  const navigation = useAppNavigation();

  // ** Modal can NOT be closed in RootRoutes.Onboarding
  // navigation.navigate(RootRoutes.Onboarding);

  navigation.navigate(RootRoutes.Root, {
    screen: HomeRoutes.HomeOnboarding,
  });
}
