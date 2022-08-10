import React, { useCallback, useEffect, useState } from 'react';

import { RefreshControl } from 'react-native';

import { ScrollView } from '@onekeyhq/components';

import { useSwapQuoteCallback } from './hooks/useSwap';
import { SwapQuoter } from './quoter';
import SwapContent from './SwapContent';
import SwapHeader from './SwapHeader';
import SwapListener from './SwapListener';
import SwapUpdater from './SwapUpdater';

const Swap = () => {
  const [refreshing, setRefreshing] = useState(false);
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
      <SwapHeader />
      <SwapListener />
      <SwapContent />
      <SwapUpdater />
    </ScrollView>
  );
};

export default Swap;
