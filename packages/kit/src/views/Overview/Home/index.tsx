import React, { FC } from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

import ActivitySection from './ActivitySection';
import BalanceSection from './BalanceSection';
import CryptoSection from './CryptoSection';
import GreetSection from './GreetSection';
import NFTSection from './NFTSection';

const OVERVIEW_MAX_WIDTH = 768;

const Overview: FC = () => {
  const inset = useSafeAreaInsets();
  return (
    <Box bg="background-default" flex="1">
      <ScrollView px="16px">
        <Box w="full" maxW={OVERVIEW_MAX_WIDTH} mx="auto" pb={inset.bottom}>
          <GreetSection />
          <BalanceSection />
          <CryptoSection />
          <NFTSection />
          <ActivitySection />
        </Box>
      </ScrollView>
    </Box>
  );
};

export default Overview;
