import { useCallback, useState } from 'react';

import { RefreshControl } from 'react-native';

import { Box, Center, ScrollView } from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import { Main } from './Main';
import { SwapHeader } from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapUpdater from './SwapUpdater';

export const Mobile = () => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
    setTimeout(() => setRefreshing(false), 500);
  }, []);
  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Center>
        <Box maxW={{ md: '480px' }} width="full">
          <Box px="4" mb="4" zIndex={1}>
            <SwapHeader />
          </Box>
          <Main />
          <SwapObserver />
          <SwapUpdater />
        </Box>
      </Center>
    </ScrollView>
  );
};
