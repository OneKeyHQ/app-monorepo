import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';

export const ValuePriceListItem = ({
  amount,
  tokenSymbol,
  fiatSymbol,
  fiatValue,
}: {
  amount: string;
  tokenSymbol: string;
  fiatSymbol: string;
  fiatValue: string;
}) => (
  <XStack space="$1" maxWidth="$56" justifyContent="flex-end" flexWrap="wrap">
    <XStack>
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
    </XStack>
    <XStack maxWidth="$56">
      <SizableText>
        (
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: fiatSymbol }}
        >
          {fiatValue}
        </NumberSizeableText>
        )
      </SizableText>
    </XStack>
  </XStack>
);
