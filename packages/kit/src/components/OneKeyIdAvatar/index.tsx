/* cspell:ignore avator */
import { memo, useMemo } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, InnerStroke, Stack, XStack } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  getBoundOAuthProviders,
  getOneKeyIdOAuthProviderIcon,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';

import { OneKeyIdDefaultAvatar } from './OneKeyIdDefaultAvatar';

// The server fills accounts without a photo with its own grey placeholder
// (the "avator" spelling is the server's); treat it as no photo.
const SERVER_PLACEHOLDER_AVATAR_PATH =
  '/server-service-prime/default_avator.png';

export function isOneKeyIdPlaceholderAvatar(url: string | undefined) {
  return Boolean(
    url?.split(/[?#]/)[0].endsWith(SERVER_PLACEHOLDER_AVATAR_PATH),
  );
}

type IOneKeyIdAvatarProps = Omit<IImageProps, 'size' | 'source'> & {
  size?: IImageProps['width'];
  source?: IImageProps['source'];
  showSocialBadge?: boolean;
};

function getSocialBadgeMetrics(size: IImageProps['width']) {
  if (size === '$20') {
    return { badgeSize: 30, iconSize: 16, right: -1, bottom: -1 };
  }
  if (size === '$16') {
    return { badgeSize: 26, iconSize: 14, right: -1, bottom: -1 };
  }
  if (size === '$14' || size === '$12') {
    return { badgeSize: 22, iconSize: 12, right: -1, bottom: -1 };
  }
  return { badgeSize: 18, iconSize: 10, right: -1, bottom: -1 };
}

export function OneKeyIdFallbackAvatar({ size = '$10', ...rest }: IImageProps) {
  return (
    <Image.Fallback
      width={size}
      height={size}
      borderRadius="$full"
      overflow="hidden"
      {...rest}
    >
      <Image size={size} source={avatarFallback} />
    </Image.Fallback>
  );
}

function BasicOneKeyIdAvatar({
  size = '$10',
  source: sourceOverride,
  showSocialBadge = true,
  ...rest
}: IOneKeyIdAvatarProps) {
  const { user, isLoggedIn } = useOneKeyAuth();
  const avatarUrl = isOneKeyIdPlaceholderAvatar(user.avatar)
    ? undefined
    : user.avatar;
  const source =
    sourceOverride ??
    (isLoggedIn && avatarUrl ? { uri: avatarUrl } : avatarFallback);
  // Signed in without a photo: the character drawn from the OneKey ID.
  const defaultAvatarSeed = isLoggedIn ? user.onekeyUserId : undefined;
  const fallback = defaultAvatarSeed ? (
    <OneKeyIdDefaultAvatar seed={defaultAvatarSeed} size={size} />
  ) : (
    <OneKeyIdFallbackAvatar size={size} />
  );
  const boundOAuthProviders = useMemo(
    () => getBoundOAuthProviders(user.onekeyAccount),
    [user.onekeyAccount],
  );
  const visibleOAuthProviders = showSocialBadge
    ? boundOAuthProviders.slice(0, 2)
    : [];
  const { badgeSize, iconSize, right, bottom } = getSocialBadgeMetrics(size);
  const badgeWidth =
    visibleOAuthProviders.length > 1 ? badgeSize + iconSize : badgeSize;

  return (
    <Stack
      width={size}
      height={size}
      borderRadius="$full"
      borderCurve="continuous"
      position="relative"
      {...rest}
    >
      <Stack
        width="100%"
        height="100%"
        borderRadius="$full"
        borderCurve="continuous"
        overflow="hidden"
      >
        {!sourceOverride && !avatarUrl && defaultAvatarSeed ? (
          <OneKeyIdDefaultAvatar seed={defaultAvatarSeed} size={size} />
        ) : (
          <Image size={size} source={source} fallback={fallback} />
        )}
        <InnerStroke
          borderRadius="$full"
          borderColor="$borderSubdued"
          opacity={0.6}
        />
      </Stack>
      {visibleOAuthProviders.length > 0 ? (
        <XStack
          position="absolute"
          right={right}
          bottom={bottom}
          w={badgeWidth}
          h={badgeSize}
          ai="center"
          jc="center"
          gap="$0.5"
          bg="$bg"
          borderRadius="$full"
          borderWidth={1}
          borderColor="$bgApp"
        >
          {visibleOAuthProviders.map((provider) => (
            <Icon
              key={provider}
              name={getOneKeyIdOAuthProviderIcon(provider)}
              size={iconSize}
              color="$icon"
            />
          ))}
        </XStack>
      ) : null}
    </Stack>
  );
}

export const OneKeyIdAvatar = memo(BasicOneKeyIdAvatar);
