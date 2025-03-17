import { useCallback, useMemo } from 'react';

import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from './useAppNavigation';

export const useReferFriends = () => {
  const navigation = useAppNavigation();
  const toReferFriendsPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.ReferAFriend,
    });
  }, [navigation]);
  return useMemo(() => ({ toReferFriendsPage }), [toReferFriendsPage]);
};
