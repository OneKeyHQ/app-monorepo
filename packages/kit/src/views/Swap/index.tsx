import { memo, useCallback } from 'react';

import { YStack } from 'tamagui';

import { Page, Text } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorTrigger,
} from '../../components/AccountSelector';

import SwapMainLand from './container/SwapMainLand';
import { withSwapProvider } from './container/WithSwapProvider';
import { useSwapNetworkList } from './hooks/useSwapTokens';

const Swap = () => {
  const onSwap = useCallback(async () => {}, []);
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
        <SwapMainLand onSwapStep={() => {}} />
      </Page.Body>
    </Page>
  );
};

export default memo(withSwapProvider(Swap));
