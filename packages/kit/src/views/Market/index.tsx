import React, { useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

import { Box } from '@onekeyhq/components/src';

import { MARKET_TAB_NAME, SWAP_TAB_NAME } from '../../store/reducers/market';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import { useMarketTopTabName } from './hooks/useMarketList';
import MarketList from './MarketList';


const Market = () => {
  const navigation = useNavigation();
  const marketTopTabName = useMarketTopTabName();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
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
