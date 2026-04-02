import type { FC } from 'react';
import { useMemo } from 'react';

import { NumberSizeableText, XStack } from '@onekeyhq/components';

interface IPriceChangeBadgeProps {
  change: number | string;
}

export const PriceChangeBadge: FC<IPriceChangeBadgeProps> = ({ change }) => {
  const changeNum = Number(change);

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
    </XStack>
  );
};
