import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../components/Format';
import { calculateGains } from '../../utils/priceUtils';

type PriceLabelProps = {
  price: number;
  basePrice: number;
  time: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price, basePrice, time }) => {
  const intl = useIntl();
  const priceLabel = intl.formatMessage({
    id: 'content__price_uppercase',
  });
  const { gainText, percentageGain, gainTextColor } = calculateGains({
    basePrice,
    price,
  });

  return (
    <Box flexDirection="column">
      <Typography.Subheading color="text-subdued">
        {priceLabel}
      </Typography.Subheading>
      <Typography.DisplayXLarge mt="4px" mb="4px">
        <FormatCurrencyNumber value={price} />
      </Typography.DisplayXLarge>
      <Box flexDirection="row">
        <Typography.Body2Strong color={gainTextColor}>
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
