import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showReferralBlockingOverlayToast } from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingOverlayGuard';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ETabHomeRoutes,
} from '@onekeyhq/shared/src/routes';

export function openReferralInvitedByFriendModalWithGuard({
  code,
  page,
  navigation,
  shouldContinue,
}: {
  code: string | undefined;
  page: string | undefined;
  navigation: IAppNavigation;
  shouldContinue: () => boolean;
}) {
  const openInvitedByFriendModal = () => {
    if (!shouldContinue()) {
      return;
    }
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.InvitedByFriend,
      params: {
        code,
        page,
      },
    });
    navigation.reset({
      index: 0,
      routes: [{ name: ETabHomeRoutes.TabHome }],
    });
  };

  if (!shouldContinue()) {
    return true;
  }

  if (
    showReferralBlockingOverlayToast({
      shouldContinue,
      onContinue: ({ shouldContinue: shouldContinueToast }) => {
        if (!shouldContinueToast()) {
          return;
        }
        openInvitedByFriendModal();
      },
    })
  ) {
    return true;
  }

  openInvitedByFriendModal();
  return false;
}
