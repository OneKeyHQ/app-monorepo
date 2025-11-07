import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToReferralLevel() {
  const navigation = useAppNavigation();

  return useCallback(() => {
    navigation.push(ETabReferFriendsRoutes.TabReferralLevel);
  }, [navigation]);
}
