import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToEarnReward() {
  const navigation = useAppNavigation();

  return useCallback(
    (
      title: IModalReferFriendsParamList[EModalReferFriendsRoutes.EarnReward]['title'],
    ) => {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.EarnReward,
        params: { title },
      });
    },
    [navigation],
  );
}
