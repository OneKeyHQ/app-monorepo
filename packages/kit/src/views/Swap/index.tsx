import { memo, useCallback, useMemo } from 'react';

import { Page, Text } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../components/AccountSelector';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import SwapMainLand from './container/SwapMainLand';
import { withSwapProvider } from './container/WithSwapProvider';

const Swap = () => {
  console.log('swap');
  // const {
  //   activeAccount: { account, wallet, network },
  // } = useActiveAccount({ num: 0 });
  // const headerLeft = useCallback(
  //   () => (
  //     <AccountSelectorProviderMirror
  //       config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
  //     >
  //       <AccountSelectorTriggerHome num={0} />
  //     </AccountSelectorProviderMirror>
  //   ),
  //   [],
  // );
  return (
    <Page>
      {/* <Page.Header headerTitle={headerLeft} /> */}
      <Text>Swap</Text>
      {/* <AccountSelectorProvider
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
      </AccountSelectorProvider> */}
      <SwapMainLand />
    </Page>
  );
};

export default memo(withSwapProvider(Swap));
