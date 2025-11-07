import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToYourReferred() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabYourReferred);
  }, [navigation]);
}
