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
  fiatValue?: string;
}) => (
  <XStack
    gap="$1"
    // maxWidth="$56"
    $gtMd={{
      maxWidth: '100%',
      minWidth: '100%',
    }}
    jc="flex-end"
    ai="flex-start"
  >
    <SizableText width="100%" textAlign="right">
      <NumberSizeableText
        width="100%"
        size="$bodyLgMedium"
        textAlign="right"
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
    </SizableText>
    <SizableText maxWidth="$56" textAlign="right">
      {fiatValue ? (
        <SizableText color="$textSubdued" textAlign="right" width="100%">
          (
          <NumberSizeableText
            width="100%"
            textAlign="right"
            size="$bodyLgMedium"
            formatter="value"
            color="$textSubdued"
            formatterOptions={{ currency: fiatSymbol }}
          >
            {fiatValue}
          </NumberSizeableText>
          )
        </SizableText>
      ) : null}
    </SizableText>
  </XStack>
);
