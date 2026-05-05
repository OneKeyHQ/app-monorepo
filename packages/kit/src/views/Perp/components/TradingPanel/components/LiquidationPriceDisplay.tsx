import { memo } from 'react';

import { NumberSizeableText, SizableText } from '@onekeyhq/components';

import { useLiquidationPrice } from '../../../hooks/useLiquidationPrice';

import type { FontSizeTokens } from 'tamagui';

const LiquidationPriceDisplay = memo(
  ({
    isMobile,
    textSize,
    side,
  }: {
    isMobile?: boolean;
    textSize?: FontSizeTokens;
    side?: 'long' | 'short';
  }) => {
    const liquidationPrice = useLiquidationPrice(side);

    if (!liquidationPrice) {
      return <SizableText size={textSize ?? '$bodySmMedium'}>--</SizableText>;
    }

    return (
      <NumberSizeableText
        size={textSize ?? '$bodySmMedium'}
        style={{
          fontSize: isMobile ? 10 : undefined,
        }}
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        {liquidationPrice.toNumber()}
      </NumberSizeableText>
    );
  },
);
LiquidationPriceDisplay.displayName = 'LiquidationPriceDisplay';

export { LiquidationPriceDisplay };
