import React, { useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import { HomeRoutes } from '../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../routes/types';
import ChainSelector from '../ChainSelector';
import { useDefaultNetWork } from '../Home/hook';
import { LiveMintingList } from '../Home/LiveMinting';
import {
  LiveMintListContext,
  LiveMintListContextValue,
  useLiveMintContext,
} from '../Home/LiveMinting/context';

const List = () => {
  const isSmallScreen = useIsVerticalLayout();
  const paddingX = isSmallScreen ? 0 : '51px';
  const navigation = useNavigation();
  const intl = useIntl();
  const setContext = useLiveMintContext()?.setContext;
  const context = useLiveMintContext()?.context;
  const defaultNetwork = useDefaultNetWork();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Live Minting',
      headerRight: () => (
        <ChainSelector
          selectedNetwork={context?.selectedNetwork ?? defaultNetwork}
          onChange={(n) => {
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
  }, [context?.selectedNetwork, defaultNetwork, intl, navigation, setContext]);

  return (
    <Box paddingX={paddingX} flex={1} paddingTop="16px">
      <LiveMintingList />
    </Box>
  );
};

const LiveMintingScreen = () => {
  const route =
    useRoute<
      RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketLiveMintingList>
    >();
  const { network } = route.params;

  const [context, setContext] = useState<LiveMintListContextValue>({
    isTab: false,
    selectedNetwork: network,
  });

  return (
    <LiveMintListContext.Provider value={{ context, setContext }}>
      <List />
    </LiveMintListContext.Provider>
  );
};

export default LiveMintingScreen;
