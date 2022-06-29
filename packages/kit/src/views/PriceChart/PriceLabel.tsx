import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import { useSettings } from '../../hooks/redux';

type PriceLabelProps = {
  price: number;
  basePrice: number;
  time: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price, basePrice, time }) => {
  const intl = useIntl();
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const priceLabel = intl.formatMessage({
    id: 'content__price_uppercase',
  });
  let gain: number | string = price - basePrice;
  const isPositive = gain > 0;
  let percentageGain: number | string = basePrice
    ? (gain / basePrice) * 100
    : 0;
  gain = isPositive ? `+${gain.toFixed(2)}` : gain.toFixed(2);
  percentageGain = isPositive
    ? `+${percentageGain.toFixed(2)}%`
    : `${percentageGain.toFixed(2)}%`;

  const decimals =
    price < 1
      ? Math.min(8, price.toString().slice(2).slice().search(/[^0]/g) + 3)
      : 2;
  const displayPrice = `${price.toFixed(
    decimals,
  )} ${selectedFiatMoneySymbol.toUpperCase()}`;

  return (
    <Box flexDirection="column">
      <Typography.Subheading color="text-subdued">
        {priceLabel}
      </Typography.Subheading>
      <Typography.DisplayXLarge mt="4px" mb="4px">
        {displayPrice}
      </Typography.DisplayXLarge>
      <Box flexDirection="row">
        <Typography.Body2Strong
          color={isPositive ? 'text-success' : 'text-critical'}
        >
          {gain}({percentageGain})
        </Typography.Body2Strong>
        <Typography.Body2Strong color="text-subdued" ml="8px">
          {time}
        </Typography.Body2Strong>
      </Box>
    </Box>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
