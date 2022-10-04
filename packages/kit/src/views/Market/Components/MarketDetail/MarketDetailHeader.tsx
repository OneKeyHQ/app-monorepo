import React, { FC } from 'react';

import { Box, Token, Typography } from '@onekeyhq/components/src';
import { MatketTokenInfo } from './MatketTokenInfo';
import { DetailActions } from './MarketDetailActions';
import MarketPriceChart from './MarketPriceChart';

export const MarketDetailHeader: FC = () => {
  console.log('MarketDetailHeader');
  return (
    <Box>
      <Box>
        <MatketTokenInfo />
        <DetailActions />
      </Box>
      <MarketPriceChart coingeckoId="ethereum" />
    </Box>
  );
};
