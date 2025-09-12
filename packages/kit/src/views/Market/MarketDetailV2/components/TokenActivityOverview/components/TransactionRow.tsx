import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BuySellRatioBar } from './BuySellRatioBar';

import type { ITransactionRowProps } from '../types';

export function TransactionRow({
  label,
  buyCount,
  sellCount,
  totalCount,
  isLoading,
}: ITransactionRowProps) {
  const intl = useIntl();
  const buyPercentage = totalCount > 0 ? (buyCount / totalCount) * 100 : 0;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyMdMedium">
          {label}:{' '}
          {isLoading ? (
            '--'
          ) : (
            <NumberSizeableText size="$bodyMdMedium" formatter="marketCap">
              {totalCount}
            </NumberSizeableText>
          )}
        </SizableText>
      </Stack>
      <BuySellRatioBar buyPercentage={buyPercentage} isLoading={isLoading} />
      <Stack flexDirection="row" justifyContent="space-between">
        <Stack flexDirection="row" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            (
            {isLoading ? (
              '--'
            ) : (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="marketCap"
              >
                {buyCount}
              </NumberSizeableText>
            )}
            )
          </SizableText>
        </Stack>

        <Stack flexDirection="row" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_sell,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            (
            {isLoading ? (
              '--'
            ) : (
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="marketCap"
              >
                {sellCount}
              </NumberSizeableText>
            )}
            )
          </SizableText>
        </Stack>
      </Stack>
    </Stack>
  );
}
