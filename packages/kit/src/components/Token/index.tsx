import type {
  IImageProps,
  IImageSourceProps,
  SizeTokens,
} from '@onekeyhq/components';
import { Icon, Image } from '@onekeyhq/components';

type ITokenProps = {
  size?: 'xl' | 'lg' | 'md' | 'sm' | 'xs';
  sourceUri?: IImageSourceProps['source']['uri'];
} & IImageProps;

const sizeMap: {
  [key in ITokenProps['size']]: {
    tokenSize: SizeTokens;
    chainSize: SizeTokens;
    fallbackIconSize: SizeTokens;
  };
} = {
  xl: { tokenSize: '$12', chainSize: '$5', fallbackIconSize: '$8' },
  lg: { tokenSize: '$10', chainSize: '$4', fallbackIconSize: '$7' },
  md: { tokenSize: '$8', chainSize: '$4', fallbackIconSize: '$6' },
  sm: { tokenSize: '$6', chainSize: '$3', fallbackIconSize: '$6' },
  xs: { tokenSize: '$5', chainSize: '$2.5', fallbackIconSize: '$5' },
};

export function Token({ size, sourceUri, ...rest }: ITokenProps) {
  const { tokenSize, chainSize } = sizeMap[size] || sizeMap.lg;

  return (
    <Image width={tokenSize} height={tokenSize} borderRadius="$full" {...rest}>
      <Image.Source
        source={{
          uri: sourceUri,
        }}
      />
      <Image.Fallback bg="$bgStrong">
        <Icon size={chainSize} name="CoinOutline" />
      </Image.Fallback>
    </Image>
  );
}
