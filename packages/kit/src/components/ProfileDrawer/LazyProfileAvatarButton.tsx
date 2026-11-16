import type { ComponentType } from 'react';

import { useIntl } from 'react-intl';

import { Image } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProfileAvatarFrame } from './ProfileAvatarFrame';

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
      <Image size="$10" borderRadius="$full" source={avatarFallback} />
    </ProfileAvatarFrame>
  );
}

export const LazyProfileAvatarButton = LazyLoad(
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
