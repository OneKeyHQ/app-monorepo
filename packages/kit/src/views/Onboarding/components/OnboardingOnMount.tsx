import { useEffect } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EOnboardingPages } from '../router/type';

export function OnboardingOnMount() {
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
