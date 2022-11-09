import React, { useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

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
  const { bottom } = useSafeAreaInsets();
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
    <ScrollView
      p={{ base: '16px', md: '32px' }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: 992,
        marginHorizontal: 'auto',
        paddingBottom: bottom,
      }}
    >
      <LiveMintingList />
    </ScrollView>
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
