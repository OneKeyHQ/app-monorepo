/* 
  Token:
  A component for render token (and NFT) images. It has a fallback icon when the image is not available. Typically used in list, card, or any other components that display small token images.
*/

import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IImageProps,
  IKeyOfIcons,
  ISizableTextProps,
  IXStackProps,
  SizeTokens,
} from '@onekeyhq/components';
import {
  Badge,
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAccountData } from '../../hooks/useAccountData';
import { NetworkAvatar, NetworkAvatarBase } from '../NetworkAvatar';

import type { ImageURISource } from 'react-native';

type ITokenSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';
export type ITokenProps = {
  isNFT?: boolean;
  fallbackIcon?: IKeyOfIcons;
  size?: ITokenSize;
  tokenImageUri?: ImageURISource['uri'];
  networkImageUri?: ImageURISource['uri'];
  showNetworkIcon?: boolean;
  networkId?: string;
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
  networkId,
  showNetworkIcon,
  fallbackIcon,
  ...rest
}: ITokenProps) {
  const { tokenImageSize, chainImageSize, fallbackIconSize } = size
    ? sizeMap[size]
    : sizeMap.lg;

  let fallbackIconName: IKeyOfIcons = isNFT
    ? 'ImageWavesOutline'
    : 'CryptoCoinOutline';

  if (fallbackIcon) {
    fallbackIconName = fallbackIcon;
  }
  const borderRadius = useMemo(() => {
    if (isNFT) {
      return '$2';
    }
    return '$full';
  }, [isNFT]);
  const tokenImage = (
    <Image
      size={tokenImageSize}
      borderRadius={borderRadius}
      source={tokenImageUri ? { uri: tokenImageUri } : undefined}
      fallback={
        <Stack
          bg="$gray5"
          ai="center"
          jc="center"
          borderRadius={borderRadius}
          w={tokenImageSize}
          h={tokenImageSize}
        >
          <Icon
            size={fallbackIconSize}
            name={fallbackIconName}
            color="$iconSubdued"
          />
        </Stack>
      }
      skeleton={
        <Skeleton w={tokenImageSize} h={tokenImageSize} radius="round" />
      }
      {...rest}
    />
  );

  if (networkImageUri) {
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
          <NetworkAvatarBase size={chainImageSize} logoURI={networkImageUri} />
        </Stack>
      </Stack>
    );
  }

  if (showNetworkIcon && networkId) {
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
          <NetworkAvatar networkId={networkId} size={chainImageSize} />
        </Stack>
      </Stack>
    );
  }

  return tokenImage;
}

export function TokenName({
  name,
  isNative,
  isAllNetworks,
  withNetwork,
  networkId,
  textProps,
  ...rest
}: {
  name: string;
  isNative?: boolean;
  isAllNetworks?: boolean;
  withNetwork?: boolean;
  networkId: string | undefined;
  textProps?: ISizableTextProps;
} & IXStackProps) {
  const { network } = useAccountData({ networkId });
  const intl = useIntl();
  return (
    <XStack alignItems="center" gap="$1" {...rest}>
      <SizableText minWidth={0} numberOfLines={1} {...textProps}>
        {name}
      </SizableText>
      {withNetwork && network ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>{network.name}</Badge.Text>
        </Badge>
      ) : null}
      {isNative && !isAllNetworks ? (
        <Tooltip
          renderContent={intl.formatMessage({
            id: ETranslations.native_token_tooltip,
          })}
          renderTrigger={
            <Icon
              flexShrink={0}
              name="GasSolid"
              color="$iconSubdued"
              size="$5"
            />
          }
        />
      ) : null}
    </XStack>
  );
}
