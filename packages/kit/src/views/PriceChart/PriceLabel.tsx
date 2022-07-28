import React from 'react';

import { FormattedNumber, useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import { useSettings } from '../../hooks/redux';
import { calculateGains, getSuggestedDecimals } from '../../utils/priceUtils';

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
  const { gainText, percentageGain, isPositive } = calculateGains({
    basePrice,
    price,
  });

  const decimals = getSuggestedDecimals(price);

  return (
    <Box flexDirection="column">
      <Typography.Subheading color="text-subdued">
        {priceLabel}
      </Typography.Subheading>
      <Typography.DisplayXLarge mt="4px" mb="4px">
        <FormattedNumber
          value={price}
          currencyDisplay="narrowSymbol"
          // eslint-disable-next-line react/style-prop-object
          style="currency"
          minimumFractionDigits={2}
          maximumFractionDigits={decimals}
          currency={selectedFiatMoneySymbol}
        />
      </Typography.DisplayXLarge>
      <Box flexDirection="row">
        <Typography.Body2Strong
          color={isPositive ? 'text-success' : 'text-critical'}
        >
          {gainText}({percentageGain})
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
