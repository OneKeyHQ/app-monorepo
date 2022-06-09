import React from 'react';

import { ScrollView } from '@onekeyhq/components';

import SwapContent from './SwapContent';
import SwapGuard from './SwapGuard';
import SwapHeader from './SwapHeader';
import SwapItems from './SwapItems';
import SwapTransactions from './SwapTransactions';
import SwapUpdator from './SwapUpdator';

const Swap = () => (
  <ScrollView>
    <SwapHeader />
    <SwapGuard />
    <SwapTransactions />
    <SwapContent />
    <SwapItems />
    <SwapUpdator />
  </ScrollView>
);

export default Swap;
