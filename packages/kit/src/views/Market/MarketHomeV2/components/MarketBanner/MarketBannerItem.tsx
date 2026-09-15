import { memo, useCallback, useMemo } from 'react';

// cspell:ignore GSPC IXIC DJIA

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_BORDER_COLOR } from '@onekeyhq/components/src/utils/animationConstants';
import { s } from '@onekeyhq/components/src/utils/scale';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { LeverageBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EMarketBannerType,
  type IMarketBannerItem,
  type IMarketBannerTokenPreview,
} from '@onekeyhq/shared/types/marketV2';

import { isMarketIndexQuoteBanner } from '../../../utils/marketBannerUtils';
import { MarketTestIDs } from '../../testIDs';

import {
  MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH,
  MARKET_BANNER_DESKTOP_WEB_LIST_MIN_HEIGHT,
  MARKET_BANNER_ITEM_WIDTH,
  MARKET_BANNER_LIST_MIN_HEIGHT,
  MARKET_BANNER_MOBILE_ITEM_WIDTH,
} from './marketBannerLayout';

type IMarketBannerItemProps = {
  item: IMarketBannerItem;
  isSmallScreen?: boolean;
  onPress?: (item: IMarketBannerItem) => void;
};

function convertThemeToken(token: string, defaultValue: string): string {
  // Convert "prefix/suffix" format to "$prefixSuffix" Tamagui token
  // e.g., "bg/subdued" -> "$bgSubdued", "text/success" -> "$textSuccess"
  // Also handles hyphenated suffixes: "bg/info-subdued" -> "$bgInfoSubdued"
  if (!token) {
    return defaultValue;
  }
  const parts = token.split('/');
  if (parts.length === 2) {
    const [prefix, suffix] = parts;
    // Convert hyphenated suffix to camelCase: "info-subdued" -> "InfoSubdued"
    const camelCaseSuffix = suffix
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return `$${prefix}${camelCaseSuffix}`;
  }
  return token.startsWith('$') ? token : `$${token}`;
}

function BannerTokenGroupComponent({ tokenLogos }: { tokenLogos?: string[] }) {
  if (!tokenLogos?.length) return null;

  const visibleTokens = tokenLogos.slice(0, 3);

  return (
    <XStack>
      {visibleTokens.map((url, index) => (
        <Stack
          key={url || index}
          borderRadius="$full"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$neutral3"
          bg="$bgStrong"
          overflow="hidden"
          {...(index !== 0 && { ml: '$-1.5' })}
        >
          <Image
            size="$5"
            borderRadius="$full"
            source={{ uri: url }}
            fallback={
              <Stack
                w="$5"
                h="$5"
                bg="$gray5"
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
              >
                <Icon size="$4" name="CryptoCoinOutline" color="$iconSubdued" />
              </Stack>
            }
          />
        </Stack>
      ))}
    </XStack>
  );
}

const BannerTokenGroup = memo(BannerTokenGroupComponent);

function LegacyMarketBannerItem({
  item,
  isSmallScreen,
  onPress,
}: IMarketBannerItemProps) {
  const { title, description, backgroundColor, tokenLogos } = item;
  const isPerps = item.type === EMarketBannerType.Perps;
  const isIndexBanner = isMarketIndexQuoteBanner(item);
  const bgColor = convertThemeToken(backgroundColor, '$bgSubdued');
  const descriptionColor = convertThemeToken(
    description?.fontColor ?? '',
    '$textSubdued',
  );

  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [onPress, item]);

  return (
    <Stack
      flexDirection="column"
      bg={bgColor}
      borderRadius="$3"
      px="$3"
      py="$3.5"
      width="$32"
      alignItems="flex-start"
      justifyContent="space-between"
      onPress={isIndexBanner ? undefined : handlePress}
      transition="quick"
      animateOnly={ANIMATE_ONLY_BORDER_COLOR}
      borderWidth={StyleSheet?.hairlineWidth ?? 1}
      borderColor="$neutral3"
      hoverStyle={isIndexBanner ? undefined : { borderColor: '$neutral4' }}
      pressStyle={isIndexBanner ? undefined : { borderColor: '$neutral5' }}
      h={118}
      userSelect="none"
      $gtMd={{
        flexDirection: 'row',
        flex: 1,
        flexBasis: 0,
        minWidth: 180,
        maxWidth: 256,
        width: 'auto',
        h: platformEnv.isNative ? 118 : 'auto',
        minHeight: 96,
        p: '$4',
        gap: '$3',
        alignItems: 'center',
      }}
    >
      <YStack
        testID={MarketTestIDs.bannerItem}
        gap="$0.5"
        flex={1}
        minWidth={0}
        width="100%"
        $gtMd={{ flex: 1, width: 'auto' }}
      >
        <XStack alignItems="flex-start" gap="$1" minWidth={0} maxWidth="100%">
          <SizableText
            size="$headingSm"
            numberOfLines={isPerps && !isSmallScreen ? 1 : 2}
            flexShrink={1}
            minWidth={0}
            ellipsizeMode="tail"
          >
            {title}
          </SizableText>
          {isPerps ? (
            <Stack flexShrink={0}>
              <LeverageBadge leverage={10} />
            </Stack>
          ) : null}
        </XStack>
        {description ? (
          <SizableText size="$bodyMdMedium" color={descriptionColor}>
            {description.text}
          </SizableText>
        ) : null}
      </YStack>
      <BannerTokenGroup tokenLogos={tokenLogos} />
    </Stack>
  );
}

function normalizeMarketValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized && Number.isFinite(Number(normalized)) ? normalized : '--';
}

const MARKET_INDEX_LOGO_URLS = {
  sp500: 'https://uni.onekey-asset.com/static/stock/s-and-p-500.png',
  nasdaq: 'https://uni.onekey-asset.com/static/stock/nasdaq-composite.png',
  dow30: 'https://uni.onekey-asset.com/static/stock/dow-30.png',
} as const;

const MARKET_INDEX_DISPLAY_CONFIG: Record<
  string,
  { labelId: ETranslations; order: number; logoUrl: string }
> = {
  GSPC: {
    labelId: ETranslations.market_index_sp500__title,
    order: 0,
    logoUrl: MARKET_INDEX_LOGO_URLS.sp500,
  },
  SPX: {
    labelId: ETranslations.market_index_sp500__title,
    order: 0,
    logoUrl: MARKET_INDEX_LOGO_URLS.sp500,
  },
  IXIC: {
    labelId: ETranslations.market_index_nasdaq__title,
    order: 1,
    logoUrl: MARKET_INDEX_LOGO_URLS.nasdaq,
  },
  COMP: {
    labelId: ETranslations.market_index_nasdaq__title,
    order: 1,
    logoUrl: MARKET_INDEX_LOGO_URLS.nasdaq,
  },
  DJI: {
    labelId: ETranslations.market_index_dow30__title,
    order: 2,
    logoUrl: MARKET_INDEX_LOGO_URLS.dow30,
  },
  DJIA: {
    labelId: ETranslations.market_index_dow30__title,
    order: 2,
    logoUrl: MARKET_INDEX_LOGO_URLS.dow30,
  },
};

function getMarketIndexDisplayConfig(token: IMarketBannerTokenPreview) {
  const symbol = token.symbol.trim().toUpperCase().replace(/^\^/, '');
  return MARKET_INDEX_DISPLAY_CONFIG[symbol];
}

function BannerQuoteRow({
  token,
  isIndex,
  isDesktopWeb,
}: {
  token: IMarketBannerTokenPreview;
  isIndex: boolean;
  isDesktopWeb: boolean;
}) {
  const intl = useIntl();
  const price = normalizeMarketValue(token.price);
  const change = normalizeMarketValue(token.priceChange24hPercent);
  const numericChange = Number(change);
  let changeColor: '$textSubdued' | '$textSuccess' | '$textCritical' | '$text' =
    '$textSubdued';
  if (Number.isFinite(numericChange)) {
    changeColor = '$text';
    if (numericChange > 0) changeColor = '$textSuccess';
    if (numericChange < 0) changeColor = '$textCritical';
  }
  const indexConfig = isIndex ? getMarketIndexDisplayConfig(token) : undefined;
  let label = token.symbol || token.name;
  if (isIndex) {
    label = indexConfig
      ? intl.formatMessage({ id: indexConfig.labelId })
      : token.name || token.symbol;
  }

  return (
    <XStack
      alignItems="center"
      gap="$2"
      h="$5"
      testID={MarketTestIDs.bannerTokenRow}
    >
      <Token
        size="xs"
        tokenImageUri={indexConfig?.logoUrl || token.logo}
        fallbackIcon={isIndex ? 'ChartColumnarOutline' : 'CryptoCoinOutline'}
      />
      <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
        <SizableText size="$bodyMdMedium" width={80} numberOfLines={1}>
          {label}
        </SizableText>
        {/* A zero basis splits the space evenly regardless of the text, so the
            right edges line up across rows. Avoid the `flex` shorthand here:
            NumberSizeableText applies it after other props, and on web it
            expands to `flex-basis: auto`, overriding this basis. */}
        <NumberSizeableText
          size={isDesktopWeb ? '$bodyMdMedium' : '$bodyMd'}
          formatter="price"
          formatterOptions={isIndex ? undefined : { currency: '$' }}
          flexGrow={1}
          flexShrink={1}
          flexBasis={0}
          minWidth={0}
          textAlign="right"
          numberOfLines={1}
          testID={MarketTestIDs.bannerTokenPrice}
        >
          {price}
        </NumberSizeableText>
        <NumberSizeableText
          size={isDesktopWeb ? '$bodyMdMedium' : '$bodyMd'}
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns: numericChange > 0 }}
          color={changeColor}
          flexGrow={1}
          flexShrink={1}
          flexBasis={0}
          minWidth={0}
          textAlign="right"
          numberOfLines={1}
          testID={MarketTestIDs.bannerTokenChange}
        >
          {change}
        </NumberSizeableText>
      </XStack>
    </XStack>
  );
}

function MarketBannerItemComponent(props: IMarketBannerItemProps) {
  const { item, isSmallScreen, onPress } = props;
  const intl = useIntl();
  // Desktop web renders cards without a background, separated by dividers.
  // Touch layouts have no hover, so they keep the filled card and always show
  // More.
  const isDesktopWeb = !isSmallScreen && !platformEnv.isNative;
  const isIndexBanner = isMarketIndexQuoteBanner(item);
  let cardWidth = MARKET_BANNER_ITEM_WIDTH;
  if (isSmallScreen) cardWidth = MARKET_BANNER_MOBILE_ITEM_WIDTH;
  if (isDesktopWeb) cardWidth = MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH;
  const tokens = useMemo(() => {
    const bannerTokens = item.tokens ?? [];
    if (isIndexBanner) {
      return bannerTokens
        .toSorted((left, right) => {
          const leftOrder = getMarketIndexDisplayConfig(left)?.order;
          const rightOrder = getMarketIndexDisplayConfig(right)?.order;
          return (
            (leftOrder ?? Number.MAX_SAFE_INTEGER) -
            (rightOrder ?? Number.MAX_SAFE_INTEGER)
          );
        })
        .slice(0, 3);
    }
    return bannerTokens
      .toSorted((left, right) => {
        const leftChange = Number(
          normalizeMarketValue(left.priceChange24hPercent),
        );
        const rightChange = Number(
          normalizeMarketValue(right.priceChange24hPercent),
        );
        if (!Number.isFinite(leftChange))
          return Number.isFinite(rightChange) ? 1 : 0;
        if (!Number.isFinite(rightChange)) return -1;
        return rightChange - leftChange;
      })
      .slice(0, 3);
  }, [isIndexBanner, item.tokens]);
  const handlePress = useCallback(() => onPress?.(item), [item, onPress]);

  // Older API deployments do not provide token previews yet.
  if (!item.tokens) return <LegacyMarketBannerItem {...props} />;

  return (
    <YStack
      testID={MarketTestIDs.bannerItem}
      group="marketBannerCard"
      onPress={isIndexBanner ? undefined : handlePress}
      role={isIndexBanner ? undefined : 'button'}
      aria-label={item.title}
      bg={
        isDesktopWeb
          ? undefined
          : convertThemeToken(item.backgroundColor, '$bgSubdued')
      }
      borderRadius="$3"
      borderCurve="continuous"
      pt={isDesktopWeb ? '$1' : '$3.5'}
      px={isDesktopWeb ? '$0' : '$3.5'}
      pb={isDesktopWeb ? '$2' : '$5'}
      width={cardWidth}
      flexShrink={0}
      gap={isDesktopWeb ? '$5' : '$6'}
      userSelect="none"
      cursor={isDesktopWeb && !isIndexBanner ? 'pointer' : undefined}
      hoverStyle={
        isIndexBanner || isDesktopWeb ? undefined : { bg: '$bgHover' }
      }
      pressStyle={
        isIndexBanner || isDesktopWeb ? undefined : { bg: '$bgActive' }
      }
    >
      <XStack
        alignItems="center"
        gap="$1"
        h={isDesktopWeb ? '$5' : s(30)}
        testID={MarketTestIDs.bannerTitle}
      >
        <XStack flex={1} minWidth={0} alignItems="center" gap="$2">
          <SizableText
            size={isDesktopWeb ? '$bodyMdMedium' : '$headingSm'}
            color={isDesktopWeb ? '$textSubdued' : undefined}
            numberOfLines={1}
            flexShrink={1}
            minWidth={0}
          >
            {item.title}
          </SizableText>
          {item.type === EMarketBannerType.Perps ? (
            <LeverageBadge leverage={10} />
          ) : null}
        </XStack>
        {isIndexBanner ? null : (
          <XStack alignItems="center" gap="$1" flexShrink={0}>
            {/* Hidden rather than unmounted so the chevron keeps its place. */}
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              opacity={isDesktopWeb ? 0 : 1}
              $group-marketBannerCard-hover={
                isDesktopWeb ? { opacity: 1 } : undefined
              }
            >
              {intl.formatMessage({ id: ETranslations.global_more })}
            </SizableText>
            <Icon
              name="ChevronRightSmallOutline"
              size={isDesktopWeb ? '$4.5' : '$4'}
              color="$iconSubdued"
            />
          </XStack>
        )}
      </XStack>
      <YStack
        gap={isDesktopWeb ? '$5' : '$4'}
        pr="$1.5"
        minHeight={
          isDesktopWeb
            ? MARKET_BANNER_DESKTOP_WEB_LIST_MIN_HEIGHT
            : MARKET_BANNER_LIST_MIN_HEIGHT
        }
      >
        {tokens.length ? (
          tokens.map((token, index) => (
            <BannerQuoteRow
              key={`${token.symbol}-${index}`}
              token={token}
              isIndex={isIndexBanner}
              isDesktopWeb={isDesktopWeb}
            />
          ))
        ) : (
          <SizableText color="$textSubdued">--</SizableText>
        )}
      </YStack>
    </YStack>
  );
}

export const MarketBannerItem = memo(MarketBannerItemComponent);
