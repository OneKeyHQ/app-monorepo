import { memo } from 'react';

import { NumberSizeableText } from '@onekeyhq/components';

import { useLiquidationPrice } from '../../../hooks/useLiquidationPrice';

const LiquidationPriceDisplay = memo(({ isMobile }: { isMobile?: boolean }) => {
  const liquidationPrice = useLiquidationPrice();
  if (!liquidationPrice) {
    return 'N/A';
  }

  return (
    <NumberSizeableText
      size={isMobile ? undefined : '$bodySmMedium'}
      style={{
        fontSize: isMobile ? '10px' : undefined,
      }}
      formatter="price"
      formatterOptions={{ currency: '$' }}
    >
      {liquidationPrice.toNumber()}
    </NumberSizeableText>
  );
});
LiquidationPriceDisplay.displayName = 'LiquidationPriceDisplay';

export { LiquidationPriceDisplay };
