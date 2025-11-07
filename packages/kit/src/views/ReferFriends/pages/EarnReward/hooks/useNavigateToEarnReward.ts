import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToEarnReward() {
  const navigation = useAppNavigation();

  return useCallback(
    (title: string) => {
      navigation.push(ETabReferFriendsRoutes.TabEarnReward, { title });
    },
    [navigation],
  );
}
