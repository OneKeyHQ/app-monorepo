import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';

function PnlCellBase({
  usdValue,
  percent,
  isSupported,
  columnWidth,
  flex: flexValue,
}: {
  usdValue: string;
  percent: string;
  isSupported: boolean;
  columnWidth?: number;
  flex?: number;
}) {
  const valueBN = new BigNumber(isSupported ? usdValue : 0);
  const isValid = isSupported && !valueBN.isNaN();
  const isPositive = isValid && valueBN.gt(0);
  const isNegative = isValid && valueBN.lt(0);

  let color = '$textSubdued';
  if (isPositive) color = '$textSuccess';
  if (isNegative) color = '$textCritical';
  const displayColor = isValid ? color : '$textSubdued';
  let prefix = '';
  if (isPositive) prefix = '+';
  if (isNegative) prefix = '-';

  return (
    <YStack w={columnWidth} flex={flexValue} alignItems="flex-end">
      {isValid ? (
        <XStack alignItems="center">
          {prefix ? (
            <SizableText size="$bodySmMedium" color={displayColor}>
              {prefix}
            </SizableText>
          ) : null}
          <Currency
            size="$bodySmMedium"
            color={displayColor}
            autoFormatter="price-marketCap"
            autoFormatterThreshold={1000}
            sourceCurrency={USD_CURRENCY_ID}
          >
            {valueBN.abs().toFixed()}
          </Currency>
        </XStack>
      ) : (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          --
        </SizableText>
      )}
      <SizableText size="$bodySm" color={displayColor}>
        {isValid ? `${percent}%` : '--'}
      </SizableText>
    </YStack>
  );
}

export const PnlCell = memo(PnlCellBase);
