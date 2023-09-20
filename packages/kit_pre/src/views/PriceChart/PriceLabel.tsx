import type { FC } from 'react';

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
      <Typography.Body2Strong color="text-subdued" ml="8px">
        +0.00(+0.00%)
      </Typography.Body2Strong>
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
