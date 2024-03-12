import { memo, useEffect } from 'react';

import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

function OnboardingOnMountCmp() {
  const navigation = useAppNavigation();
  useEffect(() => {
    void (async () => {
      const { isOnboardingDone } =
        await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
      if (!isOnboardingDone) {
        navigation.pushFullModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.GetStarted,
        });
      }
    })();
  }, [navigation]);
  return null;
}
export const OnboardingOnMount = memo(OnboardingOnMountCmp);
