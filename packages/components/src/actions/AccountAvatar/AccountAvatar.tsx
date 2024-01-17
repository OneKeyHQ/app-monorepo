import { Suspense, useEffect, useState } from 'react';

import { Image } from '../../primitives';

import makeBlockieImageUri from './makeBlockieImageUriList';

import type { IImageFallbackProps, IImageProps } from '../../primitives';
import type { ImageStyle } from 'react-native';

export interface IAccountAvatarProps extends IImageProps {
  blockieHash?: string;
  fallbackProps?: IImageFallbackProps;
}

function HashImageSource({ blockieHash }: { blockieHash: string }) {
  const [uri, setUri] = useState('');
  useEffect(() => {
    makeBlockieImageUri(blockieHash)
      .then((imageUri: string) => {
        setUri(imageUri);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [blockieHash]);
  return uri ? <Image.Source src={uri} /> : null;
}

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
        <HashImageSource blockieHash={blockieHash} />
      ) : (
        <Image.Source src={src} source={source} />
      )}
      <Image.Fallback {...fallbackProps} />
    </Image>
  );
}
