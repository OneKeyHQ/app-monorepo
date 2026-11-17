import { memo } from 'react';

import { NumberSizeableText, SizableText } from '@onekeyhq/components';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useLiquidationPrice } from '../../../hooks/useLiquidationPrice';

import type { BigNumber } from 'bignumber.js';
import type { FontSizeTokens } from 'tamagui';

const LiquidationPriceDisplay = memo(
  ({
    isMobile,
    textSize,
    side,
    size,
    formDataOverride,
  }: {
    isMobile?: boolean;
    textSize?: FontSizeTokens;
    side: 'long' | 'short';
    size: BigNumber;
    formDataOverride?: ITradingFormData;
  }) => {
    const liquidationPrice = useLiquidationPrice({
      side,
      size,
      formDataOverride,
    });

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
