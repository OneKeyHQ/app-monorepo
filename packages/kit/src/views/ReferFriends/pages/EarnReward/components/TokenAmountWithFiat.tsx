import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IRewardToken } from '@onekeyhq/shared/src/referralCode/type';

interface ITokenAmountWithFiatProps {
  token: IRewardToken;
  amount: string;
  fiatValue: string;
}

export function TokenAmountWithFiat({
  token,
  amount,
  fiatValue,
}: ITokenAmountWithFiatProps) {
  return (
    <XStack ai="center" gap="$2">
      <Token size="xs" tokenImageUri={token.logoURI} />
      <XStack ai="center" gap="$1">
        <NumberSizeableText
          formatter="balance"
          size="$bodyMd"
          formatterOptions={{
            tokenSymbol: token.symbol || '',
          }}
        >
          {amount}
        </NumberSizeableText>
        <XStack ai="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            (
          </SizableText>
          <Currency formatter="value" size="$bodyMd" color="$textSubdued">
            {fiatValue}
          </Currency>
          <SizableText size="$bodyMd" color="$textSubdued">
            )
          </SizableText>
        </XStack>
      </XStack>
    </XStack>
  );
}
