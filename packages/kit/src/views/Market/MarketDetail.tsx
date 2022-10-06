import React, { FC } from 'react';

import { Box } from '@onekeyhq/components/src';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import { MarketDetailHeader } from './Components/MarketDetail/MarketDetailHeader';
import { MarkeInfoContent } from './Components/MarketDetail/MarketInfoContent';
import { MarketStatsContent } from './Components/MarketDetail/MarketStatsContent';
import { HomeRoutes, HomeRoutesParams, RootRoutes } from '../../routes/types';
import { RouteProp, useRoute } from '@react-navigation/core';

const MarketDetailTabs: FC = () => {
  console.log('11');
  return (
    <Tabs.Container>
      <Tabs.Tab name="info">
        <MarkeInfoContent />
      </Tabs.Tab>
      <Tabs.Tab name="state">
        <MarketStatsContent />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MarketDetail>;

const MarketDetail:FC = () => {
  const route = useRoute<RouteProps>();
  const { marketTokenId } = route.params;

  return (
    <Box
      bg="background-default"
      flex={1}
      marginX="auto"
      w="100%"
      maxW={MAX_PAGE_CONTAINER_WIDTH}
    >
      <MarketDetailHeader marketTokenId={marketTokenId} />
      <MarketDetailTabs />
    </Box>
  );
};
export default MarketDetail;
