import React, { useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import { HomeRoutes } from '../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../routes/types';
import ChainSelector from '../ChainSelector';
import { StatsList } from '../Home/Stats';
import { StatsListContext, StatsListContextValue } from '../Home/Stats/context';

const StatsListScreen = () => {
  const isSmallScreen = useIsVerticalLayout();
  const paddingX = isSmallScreen ? 0 : '51px';
  const navigation = useNavigation();
  const intl = useIntl();
  const route =
    useRoute<RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketStatsList>>();
  const { network } = route.params;
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(network);
  const [context, setContext] = useState<StatsListContextValue>({
    isTab: false,
    selectedIndex: 0,
    selectedTime: 2,
    selectedNetwork,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Stats',
      headerRight: () => (
        <ChainSelector
          selectedNetwork={selectedNetwork}
          onChange={(n) => {
            setSelectedNetwork(n);
            if (setContext) {
              setContext((ctx) => ({
                ...ctx,
                selectedNetwork: n,
              }));
            }
          }}
          tiggerProps={{ paddingRight: '16px' }}
        />
      ),
    });
  }, [intl, navigation, selectedNetwork]);

  return (
    <StatsListContext.Provider value={{ context, setContext }}>
      <Box paddingX={paddingX} flex={1}>
        <StatsList />
      </Box>
    </StatsListContext.Provider>
  );
};

export default StatsListScreen;
