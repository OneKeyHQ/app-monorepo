import { SizableText, Skeleton, XStack } from '@onekeyhq/components';
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

  const isLoading = !rate || !fromTokenSymbol || !toTokenSymbol;

  return (
    <XStack alignItems="center" height="$4">
      {isLoading ? (
        <Skeleton width="$32" height="$4" />
      ) : (
        <SizableText size="$bodySm" userSelect="none" color="$textSubdued">
          {`1 ${fromTokenSymbol} = ${rateFormatted as string}`}
        </SizableText>
      )}
    </XStack>
  );
}
