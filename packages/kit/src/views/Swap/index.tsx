import { memo, useCallback } from 'react';

import { Page, Text, XStack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorTrigger,
} from '../../components/AccountSelector';

import SwapMainLand from './container/SwapMainLand';
import { withSwapProvider } from './container/WithSwapProvider';

const Swap = () => {
  console.log('swap');
  return (
    <Page>
      <Page.Body space="$4">
        <Text>Swap</Text>
        <AccountSelectorProvider
          config={{
            sceneName: EAccountSelectorSceneName.swap,
            sceneUrl: '',
          }}
          enabledNum={[0, 1]}
        >
          <AccountSelectorTrigger num={0} />
          <AccountSelectorActiveAccount num={0} />

          <AccountSelectorTrigger num={1} />
          <AccountSelectorActiveAccount num={1} />
        </AccountSelectorProvider>
        <SwapMainLand />
      </Page.Body>
    </Page>
  );
};

export default memo(withSwapProvider(Swap));
