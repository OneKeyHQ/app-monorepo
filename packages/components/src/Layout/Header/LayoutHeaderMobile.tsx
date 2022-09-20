import React from 'react';

import LayoutHeader from './index';

import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';

function LayoutHeaderMobile() {
  return (
    <LayoutHeader
      showOnDesktop={false}
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => <WalletSelectorTrigger />}
      // headerRight={() => <ChainSelector />}
      headerRight={() => <NetworkAccountSelectorTrigger />}
    />
  );
}

export { LayoutHeaderMobile };
