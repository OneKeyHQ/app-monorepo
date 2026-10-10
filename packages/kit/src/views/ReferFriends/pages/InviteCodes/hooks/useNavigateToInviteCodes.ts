import { useCallback } from 'react';

import { useIsModalPage } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

// Code management is a side task that closes back to the invite page. Inside
// the referral modal (native) it pushes onto that stack; elsewhere it opens
// the modal, so a second modal never stacks on the first.
export function useNavigateToInviteCodes() {
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();

  return useCallback(
    (inviteUrl: string) => {
      if (isModalPage) {
        navigation.push(EModalReferFriendsRoutes.InviteCodes, { inviteUrl });
        return;
      }
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteCodes,
        params: { inviteUrl },
      });
    },
    [isModalPage, navigation],
  );
}
