import { memo } from 'react';

import { NumberSizeableText, SizableText } from '@onekeyhq/components';
import { useTradingFormAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

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
    const [formData] = useTradingFormAtom();
    const liquidationPrice = useLiquidationPrice(side);

    // Trigger orders don't lock margin at placement; position state may change
    // before the trigger fires, so liquidation price is not meaningful.
    if (formData.orderMode === 'trigger') {
      return <SizableText size={textSize ?? '$bodySmMedium'}>--</SizableText>;
    }

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
