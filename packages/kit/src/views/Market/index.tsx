import { useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components/src';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { MARKET_TAB_NAME, SWAP_TAB_NAME } from '../../store/reducers/market';
import Swap from '../Swap';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import { useMarketTopTabName } from './hooks/useMarketList';
import MarketList from './MarketList';

const Market = () => {
  const navigation = useNavigation();
  const { top } = useSafeAreaInsets();
  const marketTopTabName = useMarketTopTabName();
  const isVerticalLayout = useIsVerticalLayout();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    if (!isVerticalLayout && marketTopTabName !== MARKET_TAB_NAME) {
      backgroundApiProxy.serviceMarket.switchMarketTopTab(MARKET_TAB_NAME);
    }
  }, [isVerticalLayout, marketTopTabName, navigation]);
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
    <Box flex={1} mt={`${top}px`}>
      <MarketHeader />
      {contentComponent}
    </Box>
  );
};

export default Market;
