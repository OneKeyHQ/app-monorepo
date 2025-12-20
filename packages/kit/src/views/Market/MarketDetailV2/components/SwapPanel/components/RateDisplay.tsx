import { useMemo } from 'react';

import { SizableText, Skeleton, XStack } from '@onekeyhq/components';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

export interface IRateDisplayProps {
  rate?: number;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
  loading?: boolean;
}

export function RateDisplay({
  rate,
  fromTokenSymbol,
  toTokenSymbol,
  loading,
}: IRateDisplayProps) {
  const formatter: INumberFormatProps = useMemo(
    () => ({
      formatter: 'price',
      formatterOptions: {
        tokenSymbol: toTokenSymbol || '',
      },
    }),
    [toTokenSymbol],
  );
  const rateFormatted = useMemo(
    () => (rate ? numberFormat(rate.toString(), formatter) : '-'),
    [formatter, rate],
  );

  return (
    <XStack alignItems="center" height="$4">
      {loading ? (
        <Skeleton width="$32" height="$4" />
      ) : (
        <SizableText size="$bodySm" userSelect="none" color="$textSubdued">
          {`1 ${fromTokenSymbol ?? '-'} = ${rateFormatted}`}
        </SizableText>
      )}
    </XStack>
  );
}
