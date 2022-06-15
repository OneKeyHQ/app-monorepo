import React, { FC } from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

import BalanceSection from './BalanceSection';
import CryptoSection from './CryptoSection';
import GreetSection from './GreetSection';
import NFTSection from './NFTSection';

const Overview: FC = () => {
  const inset = useSafeAreaInsets();
  return (
    <Box bg="background-default" flex="1">
      <ScrollView px="16px">
        <Box w="full" maxW={768} mx="auto" pb={inset.bottom}>
          <GreetSection />
          <BalanceSection />
          <CryptoSection />
          <NFTSection />
        </Box>
      </ScrollView>
    </Box>
  );
};

export default Overview;
