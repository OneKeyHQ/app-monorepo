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
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {amount}
      </NumberSizeableText>
    </XStack>
    <XStack maxWidth="$56">
      {fiatValue ? (
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
      ) : null}
    </SizableText>
  </Stack>
);
