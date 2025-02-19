import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';

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
  <Stack
    gap="$1"
    width="100%"
    jc="flex-end"
    ai="flex-end"
    flexDirection="column"
    $gtMd={{ flexDirection: 'row', ai: 'flex-start' }}
  >
    <SizableText
      textAlign="right"
      style={{
        wordBreak: 'break-all',
      }}
    >
      <NumberSizeableText
        size="$bodyLgMedium"
        textAlign="right"
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
    </SizableText>
    <SizableText
      textAlign="right"
      style={{
        wordBreak: 'break-all',
      }}
    >
      {fiatValue ? (
        <SizableText color="$textSubdued" textAlign="right">
          (
          <NumberSizeableText
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
  </Stack>
);
