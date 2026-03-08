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
  const buyPercentage =
    totalCount !== undefined && totalCount > 0 && buyCount !== undefined
      ? (buyCount / totalCount) * 100
      : 0;

  // Show "--" when loading OR when data is undefined (field doesn't exist)
  const showTotalPlaceholder = isLoading || totalCount === undefined;
  const showBuyPlaceholder = isLoading || buyCount === undefined;
  const showSellPlaceholder = isLoading || sellCount === undefined;
  const noData = buyCount === undefined || sellCount === undefined;

  return (
    <Stack gap="$2">
      <Stack flexDirection="row" alignItems="center" gap="$2">
        <SizableText size="$bodyMdMedium">
          {label}:{' '}
          {showTotalPlaceholder ? (
            '--'
          ) : (
            <NumberSizeableText size="$bodyMdMedium" formatter="marketCap">
              {totalCount}
            </NumberSizeableText>
          )}
        </SizableText>
      </Stack>
      <BuySellRatioBar
        buyPercentage={buyPercentage}
        isLoading={isLoading}
        noData={noData}
      />
      <Stack flexDirection="row" justifyContent="space-between">
        <Stack flexDirection="row" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_transactions_buy,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            (
            {showBuyPlaceholder ? (
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
            {showSellPlaceholder ? (
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
