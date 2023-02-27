import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../components/Format';
import { calculateGains } from '../../utils/priceUtils';

type PriceLabelProps = {
  price: number | null;
  basePrice: number;
  time: string;
  onPriceSubscribe?: () => void;
};

const PriceLabel: FC<PriceLabelProps> = ({
  price,
  basePrice,
  time,
  onPriceSubscribe,
}) => {
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
      <Pressable
        my={2}
        disabled={Boolean(!onPriceSubscribe)}
        flexDirection="row"
        alignItems="center"
        onPress={() => {
          if (onPriceSubscribe) {
            onPriceSubscribe();
          }
        }}
      >
        <Typography.DisplayXLarge mr={2}>
          <FormatCurrencyNumber value={price || 0} />
        </Typography.DisplayXLarge>
        {onPriceSubscribe ? <Icon name="BellSolid" size={20} /> : null}
      </Pressable>
      <Box flexDirection="row" alignItems="center">
        {displayInfo}
      </Box>
    </Box>
  );
};
export default PriceLabel;
