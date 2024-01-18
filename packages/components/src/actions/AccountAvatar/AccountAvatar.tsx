import { memo } from 'react';

import { Image } from '../../primitives';

import { useBlockieImageUri } from './makeBlockieImageUriList';

import type { IImageFallbackProps, IImageProps } from '../../primitives';
import type { ImageStyle } from 'react-native';

export interface IAccountAvatarProps extends IImageProps {
  blockieHash?: string;
  fallbackProps?: IImageFallbackProps;
}

function HashImageSource({ blockieHash }: { blockieHash: string }) {
  const { uri } = useBlockieImageUri(blockieHash);
  return uri ? <Image.Source src={uri} /> : null;
}

const MemoHashImageSource = memo(HashImageSource);

export function AccountAvatar({
  src,
  source,
  blockieHash,
  fallbackProps,
  circular,
  ...restProps
}: IAccountAvatarProps) {
  return (
    <Image
      size="$10"
      style={
        {
          borderCurve: 'continuous',
        } as ImageStyle
      }
      {...(circular ? { circular: true } : { borderRadius: '$2' })}
      {...restProps}
    >
      {blockieHash ? (
        <MemoHashImageSource blockieHash={blockieHash} />
      ) : (
        <Image.Source src={src} source={source} />
      )}
      <Image.Fallback {...fallbackProps} />
    </Image>
  );
}
