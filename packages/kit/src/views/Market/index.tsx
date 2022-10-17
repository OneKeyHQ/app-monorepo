import React, { useMemo } from 'react';

import { Box } from '@onekeyhq/components/src';

import { MARKET_TAB_NAME, SWAP_TAB_NAME } from '../../store/reducers/market';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import { useMarketTopTabName } from './hooks/useMarketList';
import MarketList from './MarketList';

const Market = () => {
  const marketTopTabName = useMarketTopTabName();
  const contentComponent = useMemo(() => {
    switch (marketTopTabName) {
      case MARKET_TAB_NAME:
        return <MarketList />;
      case SWAP_TAB_NAME:
        return <Swap />;
      default:
    }
  }, [marketTopTabName]);
  return (
    <Box flex={1}>
      <MarketHeader />
      {contentComponent}
    </Box>
  );
};

export default Market;
