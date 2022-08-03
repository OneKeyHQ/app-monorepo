import { useCallback, useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  HomeRoutes,
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '../routes/types';
import { wait } from '../utils/helper';

import { useAppSelector } from './redux';
import useAppNavigation from './useAppNavigation';
import useNavigation from './useNavigation';
import { useNavigationActions } from './useNavigationActions';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

export function closeExtensionWindowIfOnboardingFinished() {
  if (platformEnv.isExtensionUiStandaloneWindow) {
    window?.close?.();
  }
}

export const useOnboardingRequired = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  useEffect(() => {
    if (!boardingCompleted) {
      navigation.replace(RootRoutes.Onboarding);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export function useOnboardingDone() {
  // TODO should set s.status.boardingCompleted=true ?
  const { closeDrawer, openRootHome } = useNavigationActions();
  const onboardingDone = useCallback(
    async ({ delay = 0 }: { delay?: number } = {}) => {
      closeDrawer();
      await wait(delay);
      openRootHome();
      await wait(delay);
      closeExtensionWindowIfOnboardingFinished();
    },
    [closeDrawer, openRootHome],
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
