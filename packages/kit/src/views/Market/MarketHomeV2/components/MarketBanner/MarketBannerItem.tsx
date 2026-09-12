import { memo, useCallback, useMemo } from 'react';

// cspell:ignore GSPC IXIC DJIA

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
import { LeverageBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  EMarketBannerType,
  type IMarketBannerItem,
  type IMarketBannerTokenPreview,
} from '@onekeyhq/shared/types/marketV2';

import { MarketTestIDs } from '../../testIDs';

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
      onPress={handlePress}
      transition="quick"
      animateOnly={ANIMATE_ONLY_BORDER_COLOR}
      borderWidth={StyleSheet?.hairlineWidth ?? 1}
      borderColor="$neutral3"
      hoverStyle={{ borderColor: '$neutral4' }}
      pressStyle={{ borderColor: '$neutral5' }}
      h={118}
      userSelect="none"
      $gtMd={{
        flexDirection: 'row',
        flex: 1,
        flexBasis: 0,
        minWidth: 180,
        maxWidth: 256,
        width: 'auto',
        h: 'auto',
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

function isMarketIndexToken(token: IMarketBannerTokenPreview) {
  return token.symbol.trim().startsWith('^');
}

const MARKET_INDEX_DISPLAY_CONFIG: Record<
  string,
  { label: string; order: number }
> = {
  GSPC: { label: 'S&P 500', order: 0 },
  SPX: { label: 'S&P 500', order: 0 },
  IXIC: { label: 'NASDAQ', order: 1 },
  COMP: { label: 'NASDAQ', order: 1 },
  DJI: { label: 'Dow Jones', order: 2 },
  DJIA: { label: 'Dow Jones', order: 2 },
};

function getMarketIndexDisplayConfig(token: IMarketBannerTokenPreview) {
  const symbol = token.symbol.trim().toUpperCase().replace(/^\^/, '');
  return MARKET_INDEX_DISPLAY_CONFIG[symbol];
}

function BannerIndexColumn({ token }: { token: IMarketBannerTokenPreview }) {
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
  const displayConfig = getMarketIndexDisplayConfig(token);

  return (
    <YStack
      flex={1}
      minWidth={0}
      gap="$1"
      testID={MarketTestIDs.bannerTokenRow}
    >
      <SizableText size="$headingSm" numberOfLines={1}>
        {displayConfig?.label || token.name || token.symbol}
      </SizableText>
      <NumberSizeableText
        size="$bodyMd"
        formatter="price"
        numberOfLines={1}
        testID={MarketTestIDs.bannerTokenPrice}
      >
        {price}
      </NumberSizeableText>
      <NumberSizeableText
        size="$bodyMdMedium"
        formatter="priceChange"
        formatterOptions={{ showPlusMinusSigns: numericChange > 0 }}
        color={changeColor}
        numberOfLines={1}
        testID={MarketTestIDs.bannerTokenChange}
      >
        {change}
      </NumberSizeableText>
    </YStack>
  );
}

function BannerTokenRow({ token }: { token: IMarketBannerTokenPreview }) {
  const price = normalizeMarketValue(token.price);
  const change = normalizeMarketValue(token.priceChange24hPercent);
  const numericChange = Number(change);
  const isIndex = isMarketIndexToken(token);
  let changeColor: '$textSubdued' | '$textSuccess' | '$textCritical' | '$text' =
    '$textSubdued';
  if (Number.isFinite(numericChange)) {
    changeColor = '$text';
    if (numericChange > 0) changeColor = '$textSuccess';
    if (numericChange < 0) changeColor = '$textCritical';
  }

  return (
    <XStack
      alignItems="center"
      gap="$2"
      h="$6"
      testID={MarketTestIDs.bannerTokenRow}
    >
      <Image
        size="$6"
        borderRadius="$full"
        source={{ uri: token.logo }}
        fallback={
          <Stack
            w="$6"
            h="$6"
            bg="$bgStrong"
            borderRadius="$full"
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              size="$4"
              name={isIndex ? 'ChartColumnarOutline' : 'CryptoCoinOutline'}
              color="$iconSubdued"
            />
          </Stack>
        }
      />
      <SizableText size="$bodyMdMedium" flex={1} minWidth={0} numberOfLines={1}>
        {token.symbol || token.name}
      </SizableText>
      <NumberSizeableText
        size="$bodyMd"
        color="$textSubdued"
        formatter="price"
        formatterOptions={{ currency: '$' }}
        numberOfLines={1}
        maxWidth="$24"
        flexShrink={0}
        testID={MarketTestIDs.bannerTokenPrice}
      >
        {price}
      </NumberSizeableText>
      <NumberSizeableText
        size="$bodyMdMedium"
        formatter="priceChange"
        formatterOptions={{ showPlusMinusSigns: numericChange > 0 }}
        color={changeColor}
        numberOfLines={1}
        width="$20"
        textAlign="right"
        flexShrink={0}
        testID={MarketTestIDs.bannerTokenChange}
      >
        {change}
      </NumberSizeableText>
    </XStack>
  );
}

function MarketBannerItemComponent(props: IMarketBannerItemProps) {
  const { item, onPress } = props;
  const { isSmallScreen } = props;
  const isIndexBanner =
    item.type === EMarketBannerType.Index ||
    item.type === EMarketBannerType.StockIndex;
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
      onPress={handlePress}
      role="button"
      aria-label={item.title}
      bg={convertThemeToken(item.backgroundColor, '$bgSubdued')}
      borderRadius="$3"
      px="$4"
      py="$5"
      width={isSmallScreen ? '100%' : 336}
      flexShrink={isSmallScreen ? 1 : 0}
      gap="$5"
      userSelect="none"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.6 }}
    >
      <XStack
        alignItems="center"
        gap="$2"
        h="$6"
        testID={MarketTestIDs.bannerTitle}
        borderRadius="$1"
      >
        <SizableText
          size="$headingSm"
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {item.title}
        </SizableText>
        {item.type === EMarketBannerType.Perps ? (
          <LeverageBadge leverage={10} />
        ) : null}
        {isIndexBanner ? null : (
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
            flexShrink={0}
          />
        )}
      </XStack>
      {isIndexBanner ? (
        <XStack gap="$3" minHeight={104} alignItems="flex-start">
          {tokens.length ? (
            tokens.map((token, index) => (
              <BannerIndexColumn
                key={`${token.symbol}-${index}`}
                token={token}
              />
            ))
          ) : (
            <SizableText color="$textSubdued">--</SizableText>
          )}
        </XStack>
      ) : (
        <YStack gap="$4" minHeight={104}>
          {tokens.length ? (
            tokens.map((token, index) => (
              <BannerTokenRow key={`${token.symbol}-${index}`} token={token} />
            ))
          ) : (
            <SizableText color="$textSubdued">--</SizableText>
          )}
        </YStack>
      )}
    </YStack>
  );
}

export const MarketBannerItem = memo(MarketBannerItemComponent);
