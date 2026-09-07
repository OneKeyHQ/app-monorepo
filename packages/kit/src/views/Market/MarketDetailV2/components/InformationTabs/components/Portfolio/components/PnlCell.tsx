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
  emphasizedText = false,
}: {
  usdValue: string;
  percent: string;
  isSupported: boolean;
  columnWidth?: number;
  flex?: number;
  emphasizedText?: boolean;
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
  const topTextSize = emphasizedText ? '$bodyMdMedium' : '$bodySmMedium';

  return (
    // Tamagui resolves `flex` to `flex-basis: auto`, so flexed PnL columns
    // would size to their content and drift out of line with the header; the
    // zero basis keeps every flexed column the same width.
    <YStack
      w={columnWidth}
      flex={flexValue}
      flexBasis={flexValue === undefined ? undefined : 0}
      minWidth={flexValue === undefined ? undefined : 0}
      gap={emphasizedText ? '$0.5' : undefined}
      alignItems="flex-end"
    >
      {isValid ? (
        <XStack alignItems="center">
          {prefix ? (
            <SizableText size={topTextSize} color={displayColor}>
              {prefix}
            </SizableText>
          ) : null}
          <Currency
            size={topTextSize}
            color={displayColor}
            autoFormatter="price-marketCap"
            autoFormatterThreshold={1000}
            sourceCurrency={USD_CURRENCY_ID}
          >
            {valueBN.abs().toFixed()}
          </Currency>
        </XStack>
      ) : (
        <SizableText size={topTextSize} color="$textSubdued">
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
