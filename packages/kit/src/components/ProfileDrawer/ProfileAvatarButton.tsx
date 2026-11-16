import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useIntercomUnreadCount } from '../../hooks/useIntercomUnreadCount';
import {
  HomeFirmwareUpdateDetectHost,
  MoreActionProvider,
  useIsShowAppUpdateDot,
  useIsShowRedDot,
} from '../MoreActionButton';
import { OneKeyIdAvatar } from '../OneKeyIdAvatar';

import { ProfileAvatarFrame } from './ProfileAvatarFrame';

function ProfileAvatarWithDot() {
  const intl = useIntl();
  // Notifications moved off the header into the drawer, so their unread mark
  // joins Support replies on the avatar; updates show only when nothing is
  // unread.
  const hasUnreadNotifications = !!useIsShowRedDot();
  const hasUnreadSupport = useIntercomUnreadCount() > 0;
  const hasUpdate = !!useIsShowAppUpdateDot();
  const unread = hasUnreadNotifications || hasUnreadSupport;
  let dot: 'critical' | 'accent' | undefined;
  if (unread) dot = 'critical';
  else if (hasUpdate) dot = 'accent';
  const menuLabel = intl.formatMessage({
    id: ETranslations.address_book_menu_title,
  });
  const label = [
    menuLabel,
    hasUnreadNotifications
      ? intl.formatMessage({ id: ETranslations.global_notifications })
      : undefined,
    hasUnreadSupport
      ? intl.formatMessage({ id: ETranslations.settings_contact_us })
      : undefined,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <ProfileAvatarFrame label={label} dot={dot}>
      <OneKeyIdAvatar size="$10" showSocialBadge={false} />
    </ProfileAvatarFrame>
  );
}

export default function ProfileAvatarButton() {
  return (
    <MoreActionProvider>
      <HomeFirmwareUpdateDetectHost />
      <ProfileAvatarWithDot />
    </MoreActionProvider>
  );
}
