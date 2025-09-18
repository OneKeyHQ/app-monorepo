import { memo } from 'react';

import { NumberSizeableText } from '@onekeyhq/components';

import { useLiquidationPrice } from '../../../hooks';

const LiquidationPriceDisplay = memo(() => {
  const liquidationPrice = useLiquidationPrice();

  return (
    <NumberSizeableText
      size="$bodySmMedium"
      formatter="price"
      formatterOptions={{ currency: '$' }}
    >
      {liquidationPrice?.toNumber() || 'N/A'}
    </NumberSizeableText>
  );
});
LiquidationPriceDisplay.displayName = 'LiquidationPriceDisplay';

export { LiquidationPriceDisplay };
