import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import { ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

import ChainSelector from '../ChainSelector';
import { useDefaultNetWork } from '../Home/hook';
import { LiveMintingList } from '../Home/LiveMinting';
import {
  LiveMintListContext,
  useLiveMintContext,
} from '../Home/LiveMinting/context';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { HomeRoutesParams } from '../../../routes/types';
import type { LiveMintListContextValue } from '../Home/LiveMinting/context';
import type { RouteProp } from '@react-navigation/core';

const List = () => {
  const { bottom } = useSafeAreaInsets();
  const navigation = useNavigation();
  const setContext = useLiveMintContext()?.setContext;
  const context = useLiveMintContext()?.context;
  const defaultNetwork = useDefaultNetWork();

  const headerRight = useCallback(
    () => (
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
    [context?.selectedNetwork, defaultNetwork, setContext],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Live Minting',
      headerRight,
    });
  }, [headerRight, navigation]);

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

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <LiveMintListContext.Provider value={contextValue}>
      <List />
    </LiveMintListContext.Provider>
  );
};

export default LiveMintingScreen;
