import { useCallback, useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { MainRoutes, RootRoutes, TabRoutes } from '../routes/routesEnum';
import { setHomePageCheckBoarding } from '../store/reducers/data';
import { setOnBoardingLoadingBehindModal } from '../store/reducers/runtime';
import { wait } from '../utils/helper';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';

import { useAppSelector } from './redux';
import useNavigation from './useNavigation';
import { useNavigationActions } from './useNavigationActions';
import { useReduxReady } from './useReduxReady';

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
  const { isReady } = useReduxReady();
  useEffect(() => {
    if (!boardingCompleted && isReady) {
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
  }, [isReady]);
};

export function useOnboardingDone() {
  // TODO should set s.status.boardingCompleted=true ?
  const navigation = useNavigation<NavigationProps['navigation']>();
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
      if (platformEnv.isNative) {
        openRootHome();
      } else {
        navigation.goBack();
        navigation?.navigate(RootRoutes.Main, {
          screen: MainRoutes.Tab,
          params: {
            screen: TabRoutes.Home,
          },
        });
      }

      await wait(delay);
      closeExtensionWindowIfOnboardingFinished();

      if (showOnBoardingLoading) {
        await wait(600);
        backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
      }
    },
    [closeWalletSelector, navigation, openRootHome],
  );
  return onboardingDone;
}
