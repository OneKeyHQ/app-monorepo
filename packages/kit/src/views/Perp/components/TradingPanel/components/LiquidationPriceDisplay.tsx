import { memo } from 'react';

import { NumberSizeableText } from '@onekeyhq/components';

import { useLiquidationPrice } from '../../../hooks/useLiquidationPrice';

const LiquidationPriceDisplay = memo(() => {
  const liquidationPrice = useLiquidationPrice();

  if (!liquidationPrice) {
    return 'N/A';
  }

  return (
    <NumberSizeableText
      size="$bodySmMedium"
      formatter="price"
      formatterOptions={{ currency: '$' }}
    >
      {liquidationPrice.toNumber()}
    </NumberSizeableText>
  );
});
LiquidationPriceDisplay.displayName = 'LiquidationPriceDisplay';

export { LiquidationPriceDisplay };
