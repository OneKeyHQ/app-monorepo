import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BuySellRatioBar } from './BuySellRatioBar';

import type { ITransactionRowProps } from '../types';

export function TransactionRow({
  label,
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
          {label}: {totalCount}
        </SizableText>
      </Stack>
      <BuySellRatioBar buyPercentage={buyPercentage} />
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
