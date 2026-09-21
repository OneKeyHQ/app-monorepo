/*
  Token:
  A component for render token (and NFT) images. It has a fallback icon when the image is not available. Typically used in list, card, or any other components that display small token images.
*/

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type {
  IImageProps,
  IKeyOfIcons,
  ISizableTextProps,
  IXStackProps,
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
import { NetworkAvatar, NetworkAvatarBase } from '../NetworkAvatar';

import { type ITokenSize, TOKEN_SIZE_MAP } from './tokenSize';

import type { ImageURISource } from 'react-native';

export type ITokenProps = {
  isNFT?: boolean;
  fallbackIcon?: IKeyOfIcons;
  size?: ITokenSize;
  tokenImageUri?: ImageURISource['uri'];
  tokenImageUris?: string[];
  networkImageUri?: ImageURISource['uri'];
  showNetworkIcon?: boolean;
  showNetworkIconBorder?: boolean;
  cornerBadge?: ReactNode;
  showCornerBadgeBorder?: boolean;
  networkId?: string;
  isAggregateToken?: boolean;
} & Omit<IImageProps, 'size'>;

export function Token({
  isNFT,
  size,
  tokenImageUri,
  tokenImageUris,
  networkImageUri,
  networkId,
  showNetworkIcon,
  showNetworkIconBorder = true,
  cornerBadge,
  showCornerBadgeBorder = true,
  fallbackIcon,
  isAggregateToken,
  bg: bgProp,
  ...rest
}: ITokenProps) {
  const { tokenImageSize, chainImageSize, fallbackIconSize } = size
    ? TOKEN_SIZE_MAP[size]
    : TOKEN_SIZE_MAP.lg;

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
    bgProp ?? (themeVariant === 'light' ? '$bgApp' : '$neutral6Dark');
  const shouldShowBorder = themeVariant === 'dark';

  const fallbackElement = useMemo(
    () => (
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
    ),
    [borderRadius, tokenImageSize, fallbackIconSize, fallbackIconName],
  );

  const placeholderElement = useMemo(
    () => (
      <Skeleton
        w={rest.w ?? tokenImageSize}
        h={rest.h ?? tokenImageSize}
        radius="round"
      />
    ),
    [rest.w, rest.h, tokenImageSize],
  );

  const sharedImageProps = {
    size: tokenImageSize,
    borderRadius: borderRadius as IImageProps['borderRadius'],
    bg: resolvedBg,
    borderWidth: shouldShowBorder ? ('$px' as const) : undefined,
    borderColor: shouldShowBorder ? ('$neutral2Dark' as const) : undefined,
    fallback: fallbackElement,
    placeholder: placeholderElement,
    ...rest,
  };

  const tokenImage =
    tokenImageUris && tokenImageUris.length > 0 ? (
      <Image.WithFallbackSources
        sources={tokenImageUris}
        {...sharedImageProps}
      />
    ) : (
      <Image source={source} {...sharedImageProps} />
    );

  let overlay: ReactNode = null;
  if (cornerBadge) {
    overlay = (
      <Stack
        position="absolute"
        right="$-1"
        bottom="$-1"
        p={showCornerBadgeBorder ? '$0.5' : '$0'}
        bg={showCornerBadgeBorder ? '$bgApp' : '$transparent'}
        borderRadius="$full"
      >
        {cornerBadge}
      </Stack>
    );
  } else if (networkImageUri) {
    overlay = (
      <Stack
        position="absolute"
        right="$-1"
        bottom="$-1"
        p={showNetworkIconBorder ? '$0.5' : '$0'}
        bg={showNetworkIconBorder ? '$bgApp' : '$transparent'}
        borderRadius="$full"
      >
        <NetworkAvatarBase size={chainImageSize} logoURI={networkImageUri} />
      </Stack>
    );
  } else if (showNetworkIcon && networkId) {
    overlay = (
      <Stack
        position="absolute"
        right="$-1"
        bottom="$-1"
        p={showNetworkIconBorder ? '$0.5' : '$0'}
        bg={showNetworkIconBorder ? '$bgApp' : '$transparent'}
        borderRadius="$full"
      >
        <NetworkAvatar networkId={networkId} size={chainImageSize} />
      </Stack>
    );
  }

  // Always render the same wrapper element regardless of whether an overlay is
  // present. Callers often resolve the network logo asynchronously, and if the
  // root element type changed from <Image> to <Stack> once it arrived, React
  // would unmount and reload the token image — visible as an icon flash on
  // platforms without a synchronous image cache (Android). The wrapper only
  // takes an explicit size when it has to anchor an overlay, so plain tokens
  // keep hugging the image exactly as before.
  return (
    <Stack
      position="relative"
      width={overlay ? tokenImageSize : undefined}
      height={overlay ? tokenImageSize : undefined}
    >
      {tokenImage}
      {overlay}
    </Stack>
  );
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
  aggregateTokenList: aggregateTokenListProp,
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
  // Resolved owned aggregate sub-token list for this `$key`, passed by
  // TokenListView-side callers instead of reading
  // `aggregateTokensListMapAtom` here (tokenList cells full-delete plan, PR-1).
  // `TokenName` is a SHARED component not always mounted under the tokenList
  // store, so callers outside that context simply omit this (-> [] fallback,
  // matching the previous empty-atom behavior).
  aggregateTokenList?: IAccountToken[];
} & IXStackProps) {
  const { network } = useAccountData({ networkId });
  const intl = useIntl();

  const aggregateTokenList = aggregateTokenListProp ?? [];
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
