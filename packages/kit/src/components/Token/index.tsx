/* 
  Token:
  A component for render token (and NFT) images. It has a fallback icon when the image is not available. Typically used in list, card, or any other components that display small token images.
*/

import type { IImageProps, SizeTokens } from '@onekeyhq/components';
import { Icon, Image, Stack } from '@onekeyhq/components';

import type { ImageURISource } from 'react-native';

type ITokenSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';
type ITokenProps = {
  isNFT?: boolean;
  size?: ITokenSize;
  tokenImageUri?: ImageURISource['uri'];
  networkImageUri?: ImageURISource['uri'];
} & Omit<IImageProps, 'size'>;

const sizeMap: Record<
  ITokenSize,
  {
    tokenImageSize: SizeTokens;
    chainImageSize: SizeTokens;
    fallbackIconSize: SizeTokens;
  }
> = {
  xl: { tokenImageSize: '$12', chainImageSize: '$5', fallbackIconSize: '$8' },
  lg: { tokenImageSize: '$10', chainImageSize: '$4', fallbackIconSize: '$7' },
  md: { tokenImageSize: '$8', chainImageSize: '$4', fallbackIconSize: '$6' },
  sm: { tokenImageSize: '$6', chainImageSize: '$3', fallbackIconSize: '$6' },
  xs: { tokenImageSize: '$5', chainImageSize: '$2.5', fallbackIconSize: '$5' },
};

export function Token({
  isNFT,
  size,
  tokenImageUri,
  networkImageUri,
  ...rest
}: ITokenProps) {
  const { tokenImageSize, chainImageSize, fallbackIconSize } = size
    ? sizeMap[size]
    : sizeMap.lg;

  const tokenImage = (
    <Image
      width={tokenImageSize}
      height={tokenImageSize}
      borderRadius={isNFT ? '$2' : '$full'}
      {...rest}
    >
      <Image.Source
        source={{
          uri: tokenImageUri,
        }}
      />
      <Image.Fallback
        alignItems="center"
        justifyContent="center"
        bg="$bgStrong"
        delayMs={1000}
      >
        <Icon
          size={fallbackIconSize}
          name={isNFT ? 'ImageWavesOutline' : 'CoinOutline'}
        />
      </Image.Fallback>
    </Image>
  );

  if (!networkImageUri) return tokenImage;

  return (
    <Stack position="relative" width={tokenImageSize} height={tokenImageSize}>
      {tokenImage}
      <Stack
        position="absolute"
        right="$-1"
        bottom="$-1"
        p="$0.5"
        bg="$bgApp"
        borderRadius="$full"
      >
        <Image
          width={chainImageSize}
          height={chainImageSize}
          borderRadius="$full"
          {...rest}
        >
          <Image.Source
            source={{
              uri: networkImageUri,
            }}
          />
          <Image.Fallback bg="$bgStrong" delayMs={1000}>
            <Icon size={chainImageSize} name="QuestionmarkSolid" />
          </Image.Fallback>
        </Image>
      </Stack>
    </Stack>
  );
}
