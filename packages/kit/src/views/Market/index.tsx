import React, { useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';
import { ListRenderItem } from 'react-native';

import { Box } from '@onekeyhq/components/src';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
  MARKET_TAB_NAME,
  SWAP_TAB_NAME,
} from '../../store/reducers/market';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import { useMarketList, useMarketTopTabName } from './hooks/useMarketList';

import MarketList from './MarketList';
import Swap from '../Swap';
import { useMarketSearchTokens } from './hooks/useMarketSearch';

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
