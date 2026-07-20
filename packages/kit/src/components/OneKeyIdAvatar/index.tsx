import { memo, useMemo } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, InnerStroke, Stack, XStack } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  getBoundOAuthProviders,
  getOneKeyIdOAuthProviderIcon,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';

interface IOneKeyIdAvatarProps {
  size?: IImageProps['width'];
  source?: IImageProps['source'];
  showSocialBadge?: boolean;
}

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
}: IOneKeyIdAvatarProps & IImageProps) {
  const { user, isLoggedIn } = useOneKeyAuth();
  const avatarUrl = user.avatar;
  const source =
    sourceOverride ??
    (isLoggedIn && avatarUrl ? { uri: avatarUrl } : avatarFallback);
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
        <Image
          width="100%"
          height="100%"
          source={source}
          fallback={<OneKeyIdFallbackAvatar size={size} />}
        />
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
