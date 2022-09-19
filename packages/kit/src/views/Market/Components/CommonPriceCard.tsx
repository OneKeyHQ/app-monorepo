import React from 'react';

import { Box, Pressable, Token, Typography } from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useManageTokens } from '../../../hooks';
import { calculateGains } from '../../../utils/priceUtils';
import ChartView from '../../PriceChart/ChartView';
import PriceChart from '../../PriceChart/PriceChart';
import { CommonPriceCardProps } from '../types';

const CommonPriceCard: React.FC<CommonPriceCardProps> = ({
  onPress,
  token,
}) => {
  const tokenId = token.tokenIdOnNetwork || 'main';
  const { charts, prices } = useManageTokens();
  const chart = charts[tokenId] || [];
  const price = prices[tokenId];
  let basePrice;
  if (chart.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    basePrice = chart[0][1];
  }
  const { percentageGain, gainTextBg, gainTextColor } = calculateGains({
    basePrice,
    price,
  });
  console.log('chart---', chart);
  return (
    <Pressable
      p="4"
      borderRadius="12px"
      borderWidth={1}
      flexDirection="column"
      w="100%"
      onPress={onPress}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Token size={6} src={token.logoURI} name={token.name} />
        <ChartView
          height={20}
          data={chart}
          onHover={() => {}}
          isFetching={false}
        />
      </Box>
      <Typography.Body2Strong>
        <FormatCurrencyNumber value={+(price || 0)} />
      </Typography.Body2Strong>
      <Typography.Caption color={gainTextColor}>
        {percentageGain}
      </Typography.Caption>
    </Pressable>
  );
};

export default CommonPriceCard;
