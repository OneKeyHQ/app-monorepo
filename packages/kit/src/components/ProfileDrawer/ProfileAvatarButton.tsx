import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  HomeFirmwareUpdateDetectHost,
  MoreActionProvider,
  useWalletMetaSilentRepair,
} from '../MoreActionButton';
import { OneKeyIdAvatar } from '../OneKeyIdAvatar';

import { ProfileAvatarFrame } from './ProfileAvatarFrame';
import { useProfileDrawerMarks } from './useProfileDrawerMarks';

import type { IProfileDrawerAvatarReason } from './profileDrawerMarks';

function ProfileAvatarWithDot() {
  const intl = useIntl();
  // One red dot for anything new since the drawer was last open; the rows
  // inside keep their own marks until handled.
  const { avatarReasons } = useProfileDrawerMarks({ trackSeen: true });
  useWalletMetaSilentRepair();
  const reasonIds: Record<IProfileDrawerAvatarReason, ETranslations> = {
    notifications: ETranslations.global_notifications,
    support: ETranslations.settings_contact_us,
    firmware: ETranslations.update_firmware_available,
  };
  const label = [
    intl.formatMessage({ id: ETranslations.address_book_menu_title }),
    ...avatarReasons.map((reason) =>
      intl.formatMessage({ id: reasonIds[reason] }),
    ),
  ].join(', ');
  return (
    <ProfileAvatarFrame label={label} dot={avatarReasons.length > 0}>
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
