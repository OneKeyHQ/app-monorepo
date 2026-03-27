import { Stack, SizableText, Image } from '@onekeyhq/components';
import type { ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';

function TickerRow({
  ticker,
  onPress,
}: {
  ticker: ITrayWatchlistItem;
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
                Perps
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
          {changePrefix}{ticker.change24h.toFixed(2)}%
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
  if (!tickers || tickers.length === 0) {
    return (
      <Stack padding="$4">
        <SizableText fontSize="$bodySm" color="$textSubdued" textAlign="center">
          Add favorites in the app
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
        Watchlist
      </SizableText>
      {tickers.map((ticker, idx) => (
        <TickerRow
          key={`${ticker.type}-${ticker.symbol}-${idx}`}
          ticker={ticker}
          onPress={() => onTickerPress(ticker)}
        />
      ))}
    </Stack>
  );
}
