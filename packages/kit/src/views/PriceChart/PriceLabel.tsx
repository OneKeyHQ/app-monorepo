import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../components/Format';
import { calculateGains } from '../../utils/priceUtils';

type PriceLabelProps = {
  price: number | null;
  basePrice: number;
  time: string;
  onPriceSubscribe?: (price: number) => void;
};

const PriceLabel: FC<PriceLabelProps> = ({
  price,
  basePrice,
  time,
  onPriceSubscribe,
}) => {
  const intl = useIntl();
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
      <Pressable
        disabled={Boolean(!onPriceSubscribe)}
        flexDirection="row"
        alignItems="center"
        onPress={() => {
          if (onPriceSubscribe) {
            onPriceSubscribe(price || 0);
          }
        }}
      >
        <Typography.DisplayXLarge mr={2}>
          <FormatCurrencyNumber value={price || 0} />
        </Typography.DisplayXLarge>
        {onPriceSubscribe ? <Icon name="BellSolid" size={20} /> : null}
      </Pressable>
      <Box mt="4px" flexDirection="row" alignItems="center">
        {displayInfo}
      </Box>
    </Box>
  );
};
export default PriceLabel;
