import React, { useCallback, useEffect, useState } from 'react';

import { RefreshControl } from 'react-native';

import {
  Box,
  Center,
  ScrollView,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useSwapQuoteCallback } from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import SwapAlert from './SwapAlert';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import SwapHeader from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapUpdater from './SwapUpdater';

const Swap = () => {
  const [refreshing, setRefreshing] = useState(false);
  const isSmall = useIsVerticalLayout();
  const onSwapQuote = useSwapQuoteCallback();
  useEffect(() => {
    SwapQuoter.client.prepare();
  }, []);
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
      {!isSmall ? <SwapHeader /> : <Box h="6" />}
      <SwapObserver />
      <Center px="4">
        <Box maxW="420" width="full">
          <SwapContent />
          <SwapAlert />
          <Box my="6">
            <SwapButton />
          </Box>
          <SwapQuote />
        </Box>
      </Center>
      <SwapUpdater />
    </ScrollView>
  );
};

export default Swap;
