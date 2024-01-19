import { memo } from 'react';

import { withStaticProperties } from 'tamagui';

import { Image, Skeleton } from '../../primitives';

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

function Fallback({ delayMs = 150 }: { delayMs?: number }) {
  return (
    <Image.Fallback delayMs={delayMs}>
      <Skeleton w="$6" h="$6" />
    </Image.Fallback>
  );
}

function BasicAccountAvatar({
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
      {fallbackProps ? <Image.Fallback {...fallbackProps} /> : <Fallback />}
    </Image>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  fallback: Fallback,
});
