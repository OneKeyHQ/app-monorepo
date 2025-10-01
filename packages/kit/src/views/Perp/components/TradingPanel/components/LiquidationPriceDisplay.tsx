import { memo } from 'react';

import { NumberSizeableText } from '@onekeyhq/components';

import { useLiquidationPrice } from '../../../hooks/useLiquidationPrice';

import type { FontSizeTokens } from 'tamagui';

const LiquidationPriceDisplay = memo(
  ({
    isMobile,
    textSize,
  }: {
    isMobile?: boolean;
    textSize?: FontSizeTokens;
  }) => {
    const liquidationPrice = useLiquidationPrice();
    if (!liquidationPrice) {
      return 'N/A';
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
