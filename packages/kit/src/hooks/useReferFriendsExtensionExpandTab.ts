import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';

type IExtensionReferralExpandRoute =
  | ETabReferFriendsRoutes.TabReferAFriend
  | ETabReferFriendsRoutes.TabInviteReward
  | ETabReferFriendsRoutes.TabHardwareSalesReward;

function getExtensionReferralPath(route: IExtensionReferralExpandRoute) {
  if (route === ETabReferFriendsRoutes.TabInviteReward) {
    return '/refer-friends/invite-reward';
  }
  if (route === ETabReferFriendsRoutes.TabHardwareSalesReward) {
    return '/refer-friends/hardware-sales-reward';
  }
  return '/refer-friends';
}

function buildExtensionReferralParams(params?: object) {
  if (!params) {
    return undefined;
  }
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export async function openExtensionReferralInExpandTab(
  route: IExtensionReferralExpandRoute,
  params?: object,
) {
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({
    path: getExtensionReferralPath(route),
    params: buildExtensionReferralParams(params),
  });

  closeExtensionPopupAfterExpandTabOpen();
}
