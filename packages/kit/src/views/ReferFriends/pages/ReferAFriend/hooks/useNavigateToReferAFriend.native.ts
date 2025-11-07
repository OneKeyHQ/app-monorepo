import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (
      params?: IModalReferFriendsParamList[EModalReferFriendsRoutes.ReferAFriend],
    ) => {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.ReferAFriend,
        params,
      });
    },
    [navigation],
  );
}

export function useReplaceToReferAFriend() {
  const navigation = useAppNavigation();

  return useCallback(
    (
      params?: IModalReferFriendsParamList[EModalReferFriendsRoutes.ReferAFriend],
    ) => {
      navigation.replace(EModalReferFriendsRoutes.ReferAFriend, params);
    },
    [navigation],
  );
}
