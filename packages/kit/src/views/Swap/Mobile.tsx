import { useCallback, useState } from 'react';

import { RefreshControl } from 'react-native';

import {
  Box,
  Center,
  ScrollView,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import { useAppSelector } from '../../hooks';
import SwapChart from '../PriceChart/swap-chart/mobile';

import { Main } from './Main';
import { SwapHeader } from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapUpdater from './SwapUpdater';

const MobileChart = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  if (!inputToken || !outputToken) {
    return null;
  }

  return (
    <Box>
      <SwapChart fromToken={inputToken} toToken={outputToken} />
    </Box>
  );
};

export const Mobile = () => {
  const { top } = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const mode = useAppSelector((s) => s.swap.mode);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
    setTimeout(() => setRefreshing(false), 500);
  }, []);
  return (
    <Box flex="1" position="relative" pb={mode === 'swap' ? '10' : 0}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Center pt={`${top + 16}px`}>
          <Box maxW={{ md: '480px' }} width="full">
            <Box px="4" mb="4" zIndex={1}>
              <SwapHeader />
            </Box>
            <Main />
          </Box>
        </Center>
      </ScrollView>
      {mode === 'swap' ? (
        <Box position="absolute" bottom={0} left={0} right={0} h="9">
          <MobileChart />
        </Box>
      ) : null}
      <SwapObserver />
      <SwapUpdater />
    </Box>
  );
};
