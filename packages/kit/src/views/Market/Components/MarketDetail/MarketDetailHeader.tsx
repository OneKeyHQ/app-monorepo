import React, { FC } from 'react';

import { Box, Token, Typography } from '@onekeyhq/components/src';
import { MarketTokenInfo } from './MarketTokenInfo';
import { DetailActions } from './MarketDetailActions';
import MarketPriceChart from './MarketPriceChart';

type MarketDetailHeader = {
  marketTokenId: string;
};

export const MarketDetailHeader: FC<MarketDetailHeader> = ({
  marketTokenId,
}) => {
  console.log('MarketDetailHeader');
  return (
    <Box>
      <Box>
        <MarketTokenInfo />
        <DetailActions />
      </Box>
      <MarketPriceChart coingeckoId={marketTokenId} />
    </Box>
  );
};
