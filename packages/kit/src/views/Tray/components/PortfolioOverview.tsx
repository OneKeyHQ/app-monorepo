import BigNumber from 'bignumber.js';

import { Image, SizableText, Stack } from '@onekeyhq/components';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { IAllWalletAvatarImageNamesWithoutDividers } from '@onekeyhq/shared/src/utils/avatarUtils';

export function PortfolioOverview({
  wallet,
  account,
  totalBalance,
  onPress,
}: {
  wallet: { name: string; emoji: string; avatarImg: string };
  account: { name: string };
  totalBalance: {
    amount: string;
    currency: string;
    symbol: string;
    change24h?: number;
  };
  onPress: () => void;
}) {
  const change24h = totalBalance.change24h;
  const hasChange = typeof change24h === 'number';
  const isPositive = hasChange && change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  // BigNumber keeps precision for large balances that would overflow Number.
  const amountBn = new BigNumber(totalBalance.amount || '0');
  const formattedAmount = amountBn.isNaN()
    ? totalBalance.amount
    : amountBn.toFormat(2);
  const currencySymbol = totalBalance.symbol || '$';

  const avatarSource = wallet.avatarImg
    ? AllWalletAvatarImages[
        wallet.avatarImg as IAllWalletAvatarImageNamesWithoutDividers
      ]
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
        {(() => {
          if (avatarSource) {
            return (
              <Image
                source={avatarSource}
                width={20}
                height={20}
                borderRadius={4}
                marginRight="$1.5"
              />
            );
          }
          if (wallet.emoji) {
            return (
              <SizableText fontSize="$bodyMd" marginRight="$1.5">
                {wallet.emoji}
              </SizableText>
            );
          }
          return null;
        })()}
        <SizableText fontSize="$bodySm" color="$textSubdued">
          {wallet.name}
        </SizableText>
      </Stack>
      {account.name ? (
        <SizableText fontSize="$bodySm" color="$textSubdued" marginBottom="$1">
          {account.name}
        </SizableText>
      ) : null}
      <SizableText fontSize="$headingXl" color="$text" fontWeight="600">
        {currencySymbol}
        {formattedAmount}
      </SizableText>
      {hasChange ? (
        <SizableText fontSize="$bodySm" color={changeColor} marginTop="$1">
          {`${changePrefix}${change24h.toFixed(2)}%`}
        </SizableText>
      ) : null}
    </Stack>
  );
}
