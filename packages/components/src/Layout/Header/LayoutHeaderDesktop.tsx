import React from 'react';

import LayoutHeader from './index';

import { HStack } from '@onekeyhq/components';
import HiddenActions from '@onekeyhq/kit/src/components/Header/HiddenActions';
import { NetworkAccountSelectorTrigger } from '@onekeyhq/kit/src/components/NetworkAccountSelector';

function LayoutHeaderDesktop() {
  return (
    <LayoutHeader
      showOnDesktop
      // headerLeft={() => <AccountSelector />}
      headerLeft={() => null}
      // headerRight={() => <ChainSelector />}
      // headerRight={() => <NetworkAccountSelectorTrigger />}
      headerRight={() => (
        <HStack space={2}>
          <NetworkAccountSelectorTrigger />
          <HiddenActions />
        </HStack>
      )}
    />
  );
}

export { LayoutHeaderDesktop };
