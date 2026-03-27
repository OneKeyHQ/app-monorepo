import { Stack, SizableText } from '@onekeyhq/components';

interface ITicker {
  symbol: string;
  name: string;
  icon: string;
  price: string;
  change24h: number;
}

function TickerRow({ ticker, onPress }: { ticker: ITicker; onPress: () => void }) {
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
      <Stack flex={1}>
        <SizableText fontSize="$bodyMd" color="$text">{ticker.symbol}</SizableText>
        <SizableText fontSize="$bodySm" color="$textSubdued">{ticker.name}</SizableText>
      </Stack>
      <Stack alignItems="flex-end">
        <SizableText fontSize="$bodyMd" color="$text">{ticker.price}</SizableText>
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
  tickers: ITicker[];
  onTickerPress: (symbol: string) => void;
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
      <SizableText fontSize="$bodySm" color="$textSubdued" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
        Watchlist
      </SizableText>
      {tickers.map((ticker) => (
        <TickerRow key={ticker.symbol} ticker={ticker} onPress={() => onTickerPress(ticker.symbol)} />
      ))}
    </Stack>
  );
}
