import React from 'react';

import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

type PriceLabelProps = {
  price: number;
  basePrice: number;
  time: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price, basePrice, time }) => {
  const intl = useIntl();
  const priceLabel = intl.formatMessage({
    // TODO replace with real id
    id: 'content__total',
  });
  let gain: number | string = price - basePrice;
  const isPositive = gain >= 0;
  let percentageGain: number | string = (gain / basePrice) * 100;
  gain = isPositive ? `+${gain.toFixed(2)}` : gain.toFixed(2);
  percentageGain = isPositive
    ? `+${percentageGain.toFixed(2)}%`
    : `${percentageGain.toFixed(2)}%`;

  return (
    <>
      <Typography.DisplayXLarge>
        {priceLabel} ${price}
      </Typography.DisplayXLarge>
      <Typography.Body2Strong
        color={isPositive ? 'text-success' : 'text-critical'}
      >
        {gain}({percentageGain})
      </Typography.Body2Strong>
      <Typography.Body2Strong>{time}</Typography.Body2Strong>
    </>
  );
};
PriceLabel.displayName = 'PriceLabel';
export default PriceLabel;
