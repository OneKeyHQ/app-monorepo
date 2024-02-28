import { memo, useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EOnboardingPages } from '../router/type';

function OnboardingOnMountCmp() {
  const navigation = useAppNavigation();

  const checkOnboardingState = useCallback(async () => {
    // if (!isFocused) {
    //   return;
    // }
    const { isOnboardingDone } =
      await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
    if (!isOnboardingDone) {
      navigation.pushFullModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.GetStarted,
      });
    }
  }, [navigation]);

  useEffect(() => {
    void checkOnboardingState();
  }, [checkOnboardingState]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.AccountUpdate, checkOnboardingState);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, checkOnboardingState);
    };
  }, [checkOnboardingState]);

  return null;
}
export const OnboardingOnMount = memo(OnboardingOnMountCmp);
