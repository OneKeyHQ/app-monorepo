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

// Truncate symbol if it exceeds 20 characters
function truncateSymbol(symbol?: string): string {
  if (!symbol) return '-';
  if (symbol.length > 20) {
    return `${symbol.slice(0, 17)}...`;
  }
  return symbol;
}

export function RateDisplay({
  rate,
  fromTokenSymbol,
  toTokenSymbol,
  loading,
}: IRateDisplayProps) {
  const truncatedFromSymbol = useMemo(
    () => truncateSymbol(fromTokenSymbol),
    [fromTokenSymbol],
  );
  const truncatedToSymbol = useMemo(
    () => truncateSymbol(toTokenSymbol),
    [toTokenSymbol],
  );

  const formatter: INumberFormatProps = useMemo(
    () => ({
      formatter: 'price',
      formatterOptions: {
        tokenSymbol: truncatedToSymbol === '-' ? '' : truncatedToSymbol,
      },
    }),
    [truncatedToSymbol],
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
          {`1 ${truncatedFromSymbol} = ${rateFormatted}`}
        </SizableText>
      )}
    </XStack>
  );
}
