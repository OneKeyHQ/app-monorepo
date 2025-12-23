import { memo } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Image } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

interface IOneKeyIdAvatarProps {
  size?: IImageProps['width'];
}

function BasicOneKeyIdAvatar({
  size = '$10',
  ...rest
}: IOneKeyIdAvatarProps & IImageProps) {
  const { user, isLoggedIn } = useOneKeyAuth();

  const avatarUrl = (user as { avatarUrl?: string })?.avatarUrl;
  const source = isLoggedIn && avatarUrl ? { uri: avatarUrl } : avatarFallback;

  return (
    <Image
      width={size}
      height={size}
      borderRadius="$full"
      borderWidth={1}
      borderColor="$neutral3"
      source={source}
      fallback={
        <Image.Fallback
          width={size}
          height={size}
          borderRadius="$full"
          overflow="hidden"
        >
          <Image width={size} height={size} source={avatarFallback} />
        </Image.Fallback>
      }
      {...rest}
    />
  );
}

export const OneKeyIdAvatar = memo(BasicOneKeyIdAvatar);
