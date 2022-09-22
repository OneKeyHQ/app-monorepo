import React from 'react';

import LayoutHeader from './index';

import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';

function LayoutHeaderDesktop() {
  return (
    <LayoutHeader
      showOnDesktop
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => null}
      // headerRight={() => <ChainSelector />}
      headerRight={() => <NetworkAccountSelectorTrigger />}
    />
  );
}

export { LayoutHeaderDesktop };
