import { useIntl } from 'react-intl';

import { Image, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';

function TickerRow({
  ticker,
  perpsBadgeText,
  onPress,
}: {
  ticker: ITrayWatchlistItem;
  perpsBadgeText: string;
  onPress: () => void;
}) {
  const isPositive = ticker.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

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
      {ticker.icon ? (
        <Image
          source={{ uri: ticker.icon }}
          width={28}
          height={28}
          borderRadius={14}
          marginRight="$2.5"
        />
      ) : (
        <Stack
          width={28}
          height={28}
          borderRadius={14}
          backgroundColor="$bgStrong"
          marginRight="$2.5"
          alignItems="center"
          justifyContent="center"
        >
          <SizableText fontSize="$bodySm" color="$textSubdued">
            {ticker.symbol?.charAt(0) || '?'}
          </SizableText>
        </Stack>
      )}
      <Stack flex={1}>
        <Stack flexDirection="row" alignItems="center">
          <SizableText fontSize="$bodyMd" color="$text">
            {ticker.symbol}
          </SizableText>
          {ticker.type === 'perps' ? (
            <Stack
              backgroundColor="$bgInfoSubdued"
              paddingHorizontal="$1"
              borderRadius="$1"
              marginLeft="$1"
            >
              <SizableText fontSize={10} color="$textInfo">
                {perpsBadgeText}
              </SizableText>
            </Stack>
          ) : null}
        </Stack>
        <SizableText fontSize="$bodySm" color="$textSubdued">
          {ticker.name}
        </SizableText>
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
}: {
  tickers: ITrayWatchlistItem[];
  onTickerPress: (ticker: ITrayWatchlistItem) => void;
}) {
  const intl = useIntl();
  const perpsBadgeText = intl.formatMessage({
    id: ETranslations.tray_perps_badge,
  });

  if (!tickers || tickers.length === 0) {
    return (
      <Stack padding="$4">
        <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: ETranslations.tray_add_favorites_desc })}
        </SizableText>
      </Stack>
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
          onPress={() => onTickerPress(ticker)}
        />
      ))}
    </Stack>
  );
}
