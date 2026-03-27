import { Stack, SizableText } from '@onekeyhq/components';

export function PortfolioOverview({
  wallet,
  totalBalance,
  onPress,
}: {
  wallet: { name: string; avatar: string };
  totalBalance: { amount: string; currency: string; change24h: number };
  onPress: () => void;
}) {
  const isPositive = totalBalance.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  return (
    <Stack
      padding="$4"
      borderBottomWidth={1}
      borderBottomColor="$borderSubdued"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <SizableText fontSize="$bodySm" color="$textSubdued" marginBottom="$1">
        {wallet.name}
      </SizableText>
      <SizableText fontSize="$headingXl" color="$text" fontWeight="600">
        {totalBalance.currency === 'USD' ? '$' : ''}{totalBalance.amount}
      </SizableText>
      <SizableText fontSize="$bodySm" color={changeColor} marginTop="$1">
        {changePrefix}{totalBalance.change24h.toFixed(2)}%
      </SizableText>
    </Stack>
  );
}
