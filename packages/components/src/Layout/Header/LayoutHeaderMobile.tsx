import React from 'react';

import LayoutHeader from './index';

import { HStack } from '@onekeyhq/components';
import HiddenActions from '@onekeyhq/kit/src/components/Header/HiddenActions';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';
import WalletSelectorTrigger from '@onekeyhq/kit/src/components/WalletSelector/WalletSelectorTrigger/WalletSelectorTrigger';

function LayoutHeaderMobile() {
  return (
    <LayoutHeader
      showOnDesktop={false}
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => <WalletSelectorTrigger />}
      // headerRight={() => <ChainSelector />}
      headerRight={() => (
        <HStack space={2}>
          <NetworkAccountSelectorTrigger />
          <HiddenActions />
        </HStack>
      )}
    />
  );
}

export { LayoutHeaderMobile };
