import { useCallback, useState } from 'react';

import { RefreshControl } from 'react-native';

import { Box, Center, ScrollView } from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import SwapAlert from './SwapAlert';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapTexts from './SwapTexts';
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
      <Box h="6" />
      <Center>
        <Box maxW={{ md: '480px' }} width="full">
          <Box>
            <SwapContent />
          </Box>
          <Box px="4">
            <SwapAlert />
          </Box>
          <Box my="6" px="4">
            <SwapButton />
          </Box>
          <SwapQuote />
          <SwapTexts />
        </Box>
      </Center>
      <SwapObserver />
      <SwapUpdater />
    </ScrollView>
  );
};
