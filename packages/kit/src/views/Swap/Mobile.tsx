import React, { useCallback, useEffect, useState } from 'react';

import { RefreshControl } from 'react-native';

import {
  Box,
  Center,
  ScrollView
} from '@onekeyhq/components';

import { useSwapQuoteCallback } from './hooks/useSwap';
import SwapAlert from './SwapAlert';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapUpdater from './SwapUpdater';

export const Mobile = () => {
  const [refreshing, setRefreshing] = useState(false);
  const onSwapQuote = useSwapQuoteCallback();
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    onSwapQuote().finally(() => setRefreshing(false));
  }, [onSwapQuote]);
  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Box h="6" />
      <SwapObserver />
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
        </Box>
      </Center>
      <SwapUpdater />
    </ScrollView>
  );
};
