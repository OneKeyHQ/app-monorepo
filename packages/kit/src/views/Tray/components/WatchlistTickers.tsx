import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';

function TickerTag({
  children,
  bg,
  color,
}: {
  children: ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <XStack
      borderRadius="$1"
      bg={bg}
      justifyContent="center"
      alignItems="center"
      px="$1.5"
      minWidth={0}
      maxWidth="$24"
      overflow="hidden"
      flexShrink={1}
    >
      <SizableText
        fontSize={10}
        color={color}
        lineHeight={16}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {children}
      </SizableText>
    </XStack>
  );
}

function TickerLogo({ ticker }: { ticker: ITrayWatchlistItem }) {
  const imageSources = [
    ticker.icon,
    ...(ticker.iconUrls ?? []).filter((uri) => uri && uri !== ticker.icon),
  ].filter(Boolean);

  const fallback = (
    <Stack
      width={28}
      height={28}
      borderRadius={14}
      backgroundColor="$bgStrong"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText fontSize="$bodySm" color="$textSubdued">
        {ticker.symbol?.charAt(0) || '?'}
      </SizableText>
    </Stack>
  );

  let tokenImage = fallback;
  if (imageSources.length > 1) {
    tokenImage = (
      <Image.WithFallbackSources
        sources={imageSources}
        width={28}
        height={28}
        borderRadius={14}
        fallback={fallback}
      />
    );
  } else if (imageSources[0]) {
    tokenImage = (
      <Image
        source={{ uri: imageSources[0] }}
        width={28}
        height={28}
        borderRadius={14}
        fallback={fallback}
      />
    );
  }

  return (
    <Stack width={28} height={28} marginRight="$2.5" position="relative">
      {tokenImage}
      {ticker.networkIcon ? (
        <Stack
          position="absolute"
          right="$-1"
          bottom="$-1"
          padding="$0.5"
          backgroundColor="$bgApp"
          borderRadius="$full"
        >
          <Image
            source={{ uri: ticker.networkIcon }}
            width={12}
            height={12}
            borderRadius={6}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

function TickerTags({
  ticker,
  perpsBadgeText,
  stockOpenText,
  stockClosedText,
}: {
  ticker: ITrayWatchlistItem;
  perpsBadgeText: string;
  stockOpenText: string;
  stockClosedText: string;
}) {
  const hasTags =
    ticker.type === 'perps' ||
    ticker.maxLeverage ||
    ticker.subtitle ||
    ticker.stock?.sourceLogoUri ||
    ticker.stock?.isOpen !== undefined ||
    ticker.stock?.subtitle ||
    ticker.communityRecognized;

  if (!hasTags) return null;

  return (
    <XStack alignItems="center" gap="$1" minWidth={0} flexShrink={1}>
      {ticker.type === 'perps' ? (
        <TickerTag bg="$bgInfoSubdued" color="$textInfo">
          {perpsBadgeText}
        </TickerTag>
      ) : null}
      {ticker.maxLeverage ? (
        <TickerTag bg="$bgInfo" color="$textInfo">
          {ticker.maxLeverage}x
        </TickerTag>
      ) : null}
      {ticker.subtitle ? (
        <TickerTag bg="$bgStrong" color="$textSubdued">
          {ticker.subtitle}
        </TickerTag>
      ) : null}
      {ticker.stock?.sourceLogoUri ? (
        <Image
          width={14}
          height={14}
          borderRadius="$full"
          source={{ uri: ticker.stock.sourceLogoUri }}
        />
      ) : null}
      {ticker.stock && ticker.stock.isOpen !== undefined ? (
        <TickerTag
          bg={ticker.stock.isOpen ? '$bgSuccess' : '$bgCaution'}
          color={ticker.stock.isOpen ? '$textSuccess' : '$textCaution'}
        >
          {ticker.stock.isOpen ? stockOpenText : stockClosedText}
        </TickerTag>
      ) : null}
      {ticker.stock?.subtitle ? (
        <TickerTag bg="$bgStrong" color="$textSubdued">
          {ticker.stock.subtitle}
        </TickerTag>
      ) : null}
      {ticker.communityRecognized ? (
        <Icon name="BadgeRecognizedSolid" size="$4" color="$iconSuccess" />
      ) : null}
    </XStack>
  );
}

function TickerRow({
  ticker,
  perpsBadgeText,
  stockOpenText,
  stockClosedText,
  onPress,
}: {
  ticker: ITrayWatchlistItem;
  perpsBadgeText: string;
  stockOpenText: string;
  stockClosedText: string;
  onPress: () => void;
}) {
  const isPositive = ticker.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';
  const secondaryName =
    ticker.name &&
    ticker.name.trim().toLowerCase() !== ticker.symbol.trim().toLowerCase()
      ? ticker.name
      : '';

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <TickerLogo ticker={ticker} />
      <Stack flex={1} minWidth={0}>
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText
            fontSize="$bodyMd"
            color="$text"
            numberOfLines={1}
            ellipsizeMode="tail"
            flexShrink={1}
          >
            {ticker.symbol}
          </SizableText>
          <TickerTags
            ticker={ticker}
            perpsBadgeText={perpsBadgeText}
            stockOpenText={stockOpenText}
            stockClosedText={stockClosedText}
          />
        </XStack>
        {secondaryName ? (
          <SizableText
            fontSize="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {secondaryName}
          </SizableText>
        ) : null}
      </Stack>
      <Stack alignItems="flex-end">
        <SizableText fontSize="$bodyMd" color="$text">
          {ticker.price}
        </SizableText>
        <SizableText fontSize="$bodySm" color={changeColor}>
          {changePrefix}
          {ticker.change24h.toFixed(2)}%
        </SizableText>
      </Stack>
    </Stack>
  );
}

export function WatchlistTickers({
  tickers,
  onTickerPress,
  onEmptyPress,
}: {
  tickers: ITrayWatchlistItem[];
  onTickerPress: (ticker: ITrayWatchlistItem) => void;
  onEmptyPress?: () => void;
}) {
  const intl = useIntl();
  const perpsBadgeText = intl.formatMessage({
    id: ETranslations.tray_perps_badge,
  });
  const stockOpenText = intl.formatMessage({
    id: ETranslations.dexmarket_stock_status_open,
  });
  const stockClosedText = intl.formatMessage({
    id: ETranslations.dexmarket_stock_status_closed,
  });

  if (!tickers || tickers.length === 0) {
    return (
      <XStack
        marginHorizontal="$4"
        marginTop="$5"
        marginBottom="$5"
        minHeight={64}
        paddingHorizontal="$4"
        paddingVertical="$3"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
        backgroundColor="$bg"
        alignItems="center"
        gap="$3"
        elevation={0.5}
        onPress={onEmptyPress}
        cursor={onEmptyPress ? 'pointer' : 'default'}
        hoverStyle={onEmptyPress ? { backgroundColor: '$bgHover' } : undefined}
        pressStyle={onEmptyPress ? { backgroundColor: '$bgActive' } : undefined}
      >
        <Stack
          width="$9"
          height="$9"
          borderRadius="$full"
          backgroundColor="$brand3"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon name="PlusLargeOutline" size="$5" color="$brand9" />
        </Stack>
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          ellipsizeMode="tail"
          flex={1}
          minWidth={0}
        >
          {intl.formatMessage({ id: ETranslations.tray_add_favorites_desc })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    );
  }

  return (
    <Stack>
      <SizableText
        fontSize="$bodySm"
        color="$textSubdued"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$1"
      >
        {intl.formatMessage({ id: ETranslations.tray_watchlist_title })}
      </SizableText>
      {tickers.map((ticker, idx) => (
        <TickerRow
          key={`${ticker.type}-${ticker.symbol}-${idx}`}
          ticker={ticker}
          perpsBadgeText={perpsBadgeText}
          stockOpenText={stockOpenText}
          stockClosedText={stockClosedText}
          onPress={() => onTickerPress(ticker)}
        />
      ))}
    </Stack>
  );
}
