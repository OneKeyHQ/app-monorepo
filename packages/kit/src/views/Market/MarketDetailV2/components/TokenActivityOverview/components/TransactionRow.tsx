import { Progress, SizableText, Stack } from '@onekeyhq/components';

import type { ITransactionRowProps } from '../types';

export function TransactionRow({
  label,
  timeRange,
  buyCount,
  sellCount,
  totalCount,
}: ITransactionRowProps) {
  const buyPercentage = totalCount > 0 ? (buyCount / totalCount) * 100 : 0;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">
          {label} ({timeRange}): {totalCount}
        </SizableText>
      </Stack>
      <Progress value={buyPercentage} progressColor="$bgSuccessStrong" />
      <Stack flexDirection="row" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          Buys ({buyCount})
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          Sells ({sellCount})
        </SizableText>
      </Stack>
    </Stack>
  );
}
