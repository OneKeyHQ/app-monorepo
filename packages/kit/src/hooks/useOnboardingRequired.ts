import { useCallback, useEffect } from 'react';

import { useRouter } from 'expo-router';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { setHomePageCheckBoarding } from '../store/reducers/data';
import { setOnBoardingLoadingBehindModal } from '../store/reducers/runtime';
import { wait } from '../utils/helper';

import { useAppSelector } from './redux';
// import { useNavigationActions } from './useNavigationActions';
import { useReduxReady } from './useReduxReady';

export function closeExtensionWindowIfOnboardingFinished() {
  if (platformEnv.isExtensionUiStandaloneWindow) {
    window?.close?.();
  }
}

export const useOnboardingRequired = (isHomeCheck?: boolean) => {
  const router = useRouter();

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
        router.replace({
          pathname: '/onboarding/welcome',
          params: { disableAnimation: !!isHomeCheck },
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
};

export function useOnboardingDone() {
  // TODO should set s.status.boardingCompleted=true ?
  const router = useRouter();
  // const { closeWalletSelector, openRootHome } = useNavigationActions();
  const onboardingDone = useCallback(
    async ({
      delay = 150,
      showOnBoardingLoading,
    }: { delay?: number; showOnBoardingLoading?: boolean } = {}) => {
      if (showOnBoardingLoading) {
        backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(true));
        await wait(100);
      }

      // TODO: ExpoRouter closeWalletSelector
      // closeWalletSelector();
      await wait(delay);
      if (platformEnv.isNative) {
        // TODO: ExpoRouter openRootHome();
        // openRootHome();
      } else {
        router.back();
        router.push({
          pathname: '/main/tab/home',
        });
      }

      await wait(delay);
      closeExtensionWindowIfOnboardingFinished();

      if (showOnBoardingLoading) {
        await wait(600);
        backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
      }
    },
    [],
  );
  return onboardingDone;
}
