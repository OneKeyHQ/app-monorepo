import type { FC } from 'react';
import { useMemo } from 'react';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';

interface IPriceChangeBadgeProps {
  change: number | string;
}

export const PriceChangeBadge: FC<IPriceChangeBadgeProps> = ({ change }) => {
  const isPlaceholder = change === '-';
  const changeNum = isPlaceholder ? 0 : Number(change);

  const backgroundColor = useMemo(() => {
    if (changeNum > 0) return '$bgSuccessStrong';
    if (changeNum < 0) return '$bgCriticalStrong';
    return '$neutral9';
  }, [changeNum]);

  return (
    <XStack
      width="$20"
      height="$8"
      justifyContent="center"
      alignItems="center"
      backgroundColor={backgroundColor}
      borderRadius="$2"
    >
      {isPlaceholder ? (
        <SizableText userSelect="none" size="$bodyMdMedium" color="white">
          --
        </SizableText>
      ) : (
        <NumberSizeableText
          userSelect="none"
          numberOfLines={1}
          size="$bodyMdMedium"
          fontSize={Math.abs(changeNum) >= 10_000 ? 13 : undefined}
          color="white"
          formatter="priceChangeCapped"
          formatterOptions={{
            showPlusMinusSigns: true,
          }}
        >
          {change}
        </NumberSizeableText>
      )}
    </XStack>
  );
};
