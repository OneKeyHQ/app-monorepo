import { memo, useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

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
    appEventBus.on(EAppEventBusNames.WalletClear, checkOnboardingState);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, checkOnboardingState);
    };
  }, [checkOnboardingState]);

  return null;
}
export const OnboardingOnMount = memo(OnboardingOnMountCmp);
