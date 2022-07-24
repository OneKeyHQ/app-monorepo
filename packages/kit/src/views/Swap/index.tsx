import React, { useEffect } from 'react';

import { ScrollView } from '@onekeyhq/components';

import { SwapQuoter } from './quoter';
import SwapContent from './SwapContent';
import SwapHeader from './SwapHeader';
import SwapItems from './SwapItems';
import SwapListener from './SwapListener';
import SwapTransactions from './SwapTransactions';
import SwapUpdator from './SwapUpdator';

const Swap = () => {
  useEffect(() => {
    SwapQuoter.client.prepare();
  }, []);
  return (
    <ScrollView>
      <SwapHeader />
      <SwapListener />
      <SwapTransactions />
      <SwapContent />
      <SwapItems />
      <SwapUpdator />
    </ScrollView>
  );
};

export default Swap;
