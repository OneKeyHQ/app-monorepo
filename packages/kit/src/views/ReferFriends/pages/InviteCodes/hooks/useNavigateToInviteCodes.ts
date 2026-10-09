import { useCallback } from 'react';

import { useIsModalPage } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IReferralsPageTab } from '@onekeyhq/shared/src/routes';

// The Referrals page (codes, and the wallets and orders they brought in) is
// a side task that closes back to the invite page. Inside the referral modal
// (native) it pushes onto that stack; elsewhere it opens the modal, so a
// second modal never stacks on the first.
export function useNavigateToInviteCodes() {
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();

  return useCallback(
    (inviteUrl: string, tab?: IReferralsPageTab) => {
      if (isModalPage) {
        navigation.push(EModalReferFriendsRoutes.InviteCodes, {
          inviteUrl,
          tab,
        });
        return;
      }
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.InviteCodes,
        params: { inviteUrl, tab },
      });
    },
    [isModalPage, navigation],
  );
}
