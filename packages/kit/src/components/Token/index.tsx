/* 
  Token:
  A component for render token (and NFT) images. It has a fallback icon when the image is not available. Typically used in list, card, or any other components that display small token images.
*/

import type {
  IImageProps,
  IImageSourceProps,
  SizeTokens,
} from '@onekeyhq/components';
import { Icon, Image, Stack } from '@onekeyhq/components';

type ITokenProps = {
  isNFT?: boolean;
  size?: 'xl' | 'lg' | 'md' | 'sm' | 'xs';
  tokenImageUri?: IImageSourceProps['source']['uri'];
  chainImageUri?: IImageSourceProps['source']['uri'];
} & IImageProps;

const sizeMap: {
  [key in ITokenProps['size']]: {
    tokenImageSize: SizeTokens;
    chainImageSize: SizeTokens;
    fallbackIconSize: SizeTokens;
  };
} = {
  xl: { tokenImageSize: '$12', chainImageSize: '$5', fallbackIconSize: '$8' },
  lg: { tokenImageSize: '$10', chainImageSize: '$4', fallbackIconSize: '$7' },
  md: { tokenImageSize: '$8', chainImageSize: '$4', fallbackIconSize: '$6' },
  sm: { tokenImageSize: '$6', chainImageSize: '$3', fallbackIconSize: '$6' },
  xs: { tokenImageSize: '$5', chainImageSize: '$2.5', fallbackIconSize: '$5' },
};

export function Token({
  size,
  tokenImageUri,
  chainImageUri,
  ...rest
}: ITokenProps) {
  const { isNFT, tokenImageSize, chainImageSize, fallbackIconSize } =
    sizeMap[size] || sizeMap.lg;

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

  if (!chainImageUri) return tokenImage;

  return (
    <Stack>
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
              uri: chainImageUri,
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
