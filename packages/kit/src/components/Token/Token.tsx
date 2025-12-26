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
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useAccountData } from '../../hooks/useAccountData';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { useAggregateTokensListMapAtom } from '../../states/jotai/contexts/tokenList';
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
  isAggregateToken?: boolean;
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
  isAggregateToken,
  bg: bgProp,
  ...rest
}: ITokenProps) {
  const { tokenImageSize, chainImageSize, fallbackIconSize } = size
    ? sizeMap[size]
    : sizeMap.lg;

  const themeVariant = useThemeVariant();

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
  const source = useMemo(() => {
    return tokenImageUri ? { uri: tokenImageUri } : undefined;
  }, [tokenImageUri]);

  const resolvedBg =
    bgProp ?? (themeVariant === 'light' ? undefined : '$neutral6Dark');
  const shouldShowBorder = themeVariant === 'dark';

  const tokenImage = (
    <Image
      size={tokenImageSize}
      borderRadius={borderRadius}
      source={source}
      bg={resolvedBg}
      borderWidth={shouldShowBorder ? '$px' : undefined}
      borderColor={shouldShowBorder ? '$neutral2Dark' : undefined}
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
        <Skeleton
          w={rest.w ?? tokenImageSize}
          h={rest.h ?? tokenImageSize}
          radius="round"
        />
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
  $key,
  name,
  isNative,
  isAllNetworks,
  withNetwork,
  networkId,
  textProps,
  isAggregateToken,
  withAggregateBadge,
  allAggregateTokenMap,
  ...rest
}: {
  $key: string;
  name: string;
  isNative?: boolean;
  isAllNetworks?: boolean;
  withNetwork?: boolean;
  networkId: string | undefined;
  textProps?: ISizableTextProps;
  isAggregateToken?: boolean;
  withAggregateBadge?: boolean;
  allAggregateTokenMap?: Record<string, { tokens: IAccountToken[] }>;
} & IXStackProps) {
  const { network } = useAccountData({ networkId });
  const intl = useIntl();

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const aggregateTokenList = aggregateTokensListMap[$key]?.tokens ?? [];
  const allAggregateTokenList = allAggregateTokenMap?.[$key]?.tokens ?? [];
  const firstAggregateToken = aggregateTokenList?.[0] ?? [];
  const { network: firstAggregateTokenNetwork } = useAccountData({
    networkId: firstAggregateToken?.networkId,
  });

  return (
    <XStack alignItems="center" gap="$1" {...rest}>
      <SizableText minWidth={0} numberOfLines={1} {...textProps}>
        {name}
      </SizableText>
      {isAllNetworks &&
      withAggregateBadge &&
      isAggregateToken &&
      aggregateTokenList &&
      (aggregateTokenList.length > 1 || allAggregateTokenList.length > 1) ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.global__multichain })}
          </Badge.Text>
        </Badge>
      ) : null}
      {withNetwork &&
      ((network && !network.isAggregateNetwork && !isAggregateToken) ||
        (firstAggregateTokenNetwork &&
          aggregateTokenList?.length === 1 &&
          allAggregateTokenList.length === 0)) ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>
            {network?.isAggregateNetwork
              ? firstAggregateTokenNetwork?.name
              : network?.name || firstAggregateTokenNetwork?.name}
          </Badge.Text>
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
