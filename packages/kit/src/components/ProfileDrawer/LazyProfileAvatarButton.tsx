import type { ComponentType } from 'react';

import { useIntl } from 'react-intl';

import { Image } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ErrorBoundarySimple } from '../ErrorBoundary';

import { PROFILE_AVATAR_SIZE, ProfileAvatarFrame } from './ProfileAvatarFrame';

// The real button pulls the update and unread checks; until it loads the
// default avatar already opens the drawer.
function ProfileAvatarButtonFallback() {
  const intl = useIntl();
  return (
    <ProfileAvatarFrame
      label={intl.formatMessage({ id: ETranslations.address_book_menu_title })}
    >
      {/* The plain default avatar: the OneKey ID one pulls the sign-in
          state, which the real button loads. */}
      <Image
        size={PROFILE_AVATAR_SIZE}
        borderRadius="$full"
        source={avatarFallback}
      />
    </ProfileAvatarFrame>
  );
}

const ProfileAvatarButtonLoader = LazyLoad(
  async () => {
    const { default: ProfileAvatarButton } =
      await import('./ProfileAvatarButton');
    return {
      default: ProfileAvatarButton as ComponentType<Record<string, unknown>>,
    };
  },
  undefined,
  <ProfileAvatarButtonFallback />,
);

// A button that fails to load keeps the default avatar, which still opens the
// drawer, instead of the app's error screen.
export function LazyProfileAvatarButton() {
  return (
    <ErrorBoundarySimple fallback={<ProfileAvatarButtonFallback />}>
      <ProfileAvatarButtonLoader />
    </ErrorBoundarySimple>
  );
}
