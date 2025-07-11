import { SizableText, XStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

export interface IRateDisplayProps {
  rate?: number;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
}

export function RateDisplay({
  rate,
  fromTokenSymbol,
  toTokenSymbol,
}: IRateDisplayProps) {
  const rateFormatted = rate
    ? numberFormat(rate.toString(), {
        formatter: 'price',
        formatterOptions: {
          tokenSymbol: toTokenSymbol || '',
        },
      })
    : '-';
  return (
    <XStack alignItems="center" mb="$-2" mt="$-2">
      <SizableText size="$bodySm" userSelect="none" color="$textSubdued">
        {`1 ${fromTokenSymbol ?? '?'} = ${(rateFormatted as string) ?? '-'}`}
      </SizableText>
    </XStack>
  );
}
