import { memo } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Image, InnerStroke, Stack } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

interface IOneKeyIdAvatarProps {
  size?: IImageProps['width'];
  source?: IImageProps['source'];
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
  ...rest
}: IOneKeyIdAvatarProps & IImageProps) {
  const { user, isLoggedIn } = useOneKeyAuth();
  const avatarUrl = user.avatar;
  const source =
    sourceOverride ??
    (isLoggedIn && avatarUrl ? { uri: avatarUrl } : avatarFallback);

  return (
    <Stack
      width={size}
      height={size}
      borderRadius="$full"
      borderCurve="continuous"
      overflow="hidden"
      {...rest}
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
  );
}

export const OneKeyIdAvatar = memo(BasicOneKeyIdAvatar);
