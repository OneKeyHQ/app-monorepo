import { Stack, SizableText, Image } from '@onekeyhq/components';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { IAllWalletAvatarImageNamesWithoutDividers } from '@onekeyhq/shared/src/utils/avatarUtils';

export function PortfolioOverview({
  wallet,
  totalBalance,
  onPress,
}: {
  wallet: { name: string; emoji: string; avatarImg: string };
  totalBalance: { amount: string; currency: string; change24h: number };
  onPress: () => void;
}) {
  const isPositive = totalBalance.change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  const cur = (totalBalance.currency || '').toLowerCase();
  const currencySymbol =
    cur === 'usd' ? '$' :
    cur === 'cny' ? '¥' :
    cur === 'eur' ? '€' :
    cur === 'gbp' ? '£' :
    cur === 'jpy' ? '¥' : '$';
  const formattedAmount = Number(totalBalance.amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const avatarSource =
    wallet.avatarImg
      ? AllWalletAvatarImages[wallet.avatarImg as IAllWalletAvatarImageNamesWithoutDividers]
      : undefined;

  return (
    <Stack
      padding="$4"
      borderBottomWidth={1}
      borderBottomColor="$borderSubdued"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flexDirection="row" alignItems="center" marginBottom="$1">
        {avatarSource ? (
          <Image
            source={avatarSource}
            width={20}
            height={20}
            borderRadius={4}
            marginRight="$1.5"
          />
        ) : wallet.emoji ? (
          <SizableText fontSize="$bodyMd" marginRight="$1.5">
            {wallet.emoji}
          </SizableText>
        ) : null}
        <SizableText fontSize="$bodySm" color="$textSubdued">
          {wallet.name}
        </SizableText>
      </Stack>
      <SizableText fontSize="$headingXl" color="$text" fontWeight="600">
        {currencySymbol}{formattedAmount}
      </SizableText>
      <SizableText fontSize="$bodySm" color={changeColor} marginTop="$1">
        {changePrefix}{totalBalance.change24h.toFixed(2)}%
      </SizableText>
    </Stack>
  );
}
