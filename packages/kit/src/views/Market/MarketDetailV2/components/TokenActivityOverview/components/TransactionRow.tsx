import { useIntl } from 'react-intl';

import { Progress, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ITransactionRowProps } from '../types';

export function TransactionRow({
  label,
  timeRange,
  buyCount,
  sellCount,
  totalCount,
}: ITransactionRowProps) {
  const intl = useIntl();
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
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_buy,
          })}{' '}
          ({buyCount})
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_sell,
          })}{' '}
          ({sellCount})
        </SizableText>
      </Stack>
    </Stack>
  );
}
