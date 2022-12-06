import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Typography } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../components/Format';
import { calculateGains } from '../../utils/priceUtils';

type PriceLabelProps = {
  price: number | null;
  basePrice: number;
  time: string;
};

const PriceLabel: React.FC<PriceLabelProps> = ({ price, basePrice, time }) => {
  const intl = useIntl();
  const priceLabel = intl.formatMessage({
    id: 'content__price_uppercase',
  });
  let displayInfo;
  if (price !== null) {
    const { gainText, percentageGain, gainTextColor } = calculateGains({
      basePrice,
      price,
    });
    displayInfo = (
      <>
        <Typography.Body2Strong color={gainTextColor}>
          {gainText}({percentageGain})
        </Typography.Body2Strong>
        <Typography.Body2Strong color="text-subdued" ml="8px">
          {time}
        </Typography.Body2Strong>
      </>
    );
  } else {
    displayInfo = (
      <>
        <Icon name="ExclamationTriangleMini" size={16} />
        <Typography.Body2Strong color="text-subdued" ml="8px">
          {intl.formatMessage({
            id: 'content__data_for_this_token_is_not_included_yet',
          })}
        </Typography.Body2Strong>
      </>
    );
  }
  // const { selectedFiatMoneySymbol } = useSettings();
  return (
    <Box flexDirection="column">
      <Typography.Subheading color="text-subdued">
        {priceLabel}
      </Typography.Subheading>
      <Typography.DisplayXLarge mt="4px" mb="4px">
        <FormatCurrencyNumber value={price || 0} />
        {/* {`${getFiatCodeUnit(selectedFiatMoneySymbol)}${formatMarketValueForInfo(
          price || 0,
        )}`} */}
      </Typography.DisplayXLarge>
      <Box flexDirection="row" alignItems="center">
        {displayInfo}
      </Box>
    </Box>
  );
};
export default PriceLabel;
