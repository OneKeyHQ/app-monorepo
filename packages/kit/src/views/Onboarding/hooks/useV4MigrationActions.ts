import { useCallback } from 'react';

import {
  EModalRoutes,
  EOnboardingPages,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function useV4MigrationActions() {
  const navigation = useAppNavigation();

  const navigateToV4MigrationPage = useCallback(() => {
    // TODO navigation.pushFullModal
    navigation.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.OnboardingModal,
      params: {
        screen: EOnboardingPages.V4MigrationGetStarted,
      },
    });
  }, [navigation]);

  return {
    navigateToV4MigrationPage,
  };
}
