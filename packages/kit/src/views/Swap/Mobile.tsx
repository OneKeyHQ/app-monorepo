import { useCallback, useState } from 'react';

import { RefreshControl } from 'react-native';

import {
  Box,
  Center,
  ScrollView,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import SwapAlert from './SwapAlert';
import SwapBanner from './SwapBanner';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import { SwapHeaderButtons } from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapUpdater from './SwapUpdater';

export const Mobile = () => {
  const [refreshing, setRefreshing] = useState(false);
  const isSmall = useIsVerticalLayout();

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
          {isSmall ? null : (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              px="4"
              mb="4"
              zIndex={1}
            >
              <Box />
              <SwapHeaderButtons />
            </Box>
          )}
          <Box px={isSmall ? undefined : 4}>
            <SwapContent />
          </Box>
          <Box px="4">
            <SwapAlert />
          </Box>
          <Center py="3">
            <SwapBanner />
          </Center>
          <Box mb="6" px="4">
            <SwapButton />
          </Box>
          <SwapQuote />
        </Box>
      </Center>
      <SwapObserver />
      <SwapUpdater />
    </ScrollView>
  );
};
