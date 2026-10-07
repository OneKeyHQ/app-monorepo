import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

// Code management is a side task, so it opens as a modal on every platform
// and closes back to the invite page.
export function useNavigateToInviteCodes() {
  const navigation = useAppNavigation();

  return useCallback(
    (inviteUrl: string) => {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteCodes,
        params: { inviteUrl },
      });
    },
    [navigation],
  );
}
