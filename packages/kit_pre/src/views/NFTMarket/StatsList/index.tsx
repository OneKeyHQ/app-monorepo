import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import { ScrollView, useSafeAreaInsets } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import ChainSelector from '../ChainSelector';
import { StatsList } from '../Home/Stats';
import { StatsListContext } from '../Home/Stats/context';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { HomeRoutesParams } from '../../../routes/types';
import type { StatsListContextValue } from '../Home/Stats/context';
import type { RouteProp } from '@react-navigation/core';

const StatsListScreen = () => {
  const { bottom } = useSafeAreaInsets();
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<HomeRoutesParams, HomeRoutes.NFTMarketStatsList>>();
  const { network, selectedIndex } = route.params;
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(network);
  const [context, setContext] = useState<StatsListContextValue>({
    isTab: false,
    selectedIndex,
    selectedTime: 2,
    selectedNetwork,
  });

  const headerRight = useCallback(
    () => (
      <ChainSelector
        triggerSize="lg"
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
    [selectedNetwork],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Stats',
      headerRight,
    });
  }, [headerRight, navigation]);

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <StatsListContext.Provider value={contextValue}>
      <ScrollView
        p={{ base: '16px', md: '32px' }}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 992,
          paddingBottom: bottom,
          alignSelf: 'center',
        }}
      >
        <StatsList />
      </ScrollView>
    </StatsListContext.Provider>
  );
};

export default StatsListScreen;
