import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';

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
        <NumberSizeableText
          size="$bodySmMedium"
          color={displayColor}
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
          formatterOptions={{
            currency: `${prefix}$`,
          }}
        >
          {valueBN.abs().toFixed()}
        </NumberSizeableText>
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
