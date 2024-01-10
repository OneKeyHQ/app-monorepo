import { useCallback } from 'react';

import { Page, SizableText } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
} from '../../components/AccountSelector';

import SwapMainLand from './container/SwapMainLand';

const SwapPage = () => {
  console.log('swap---22');
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
      >
        <AccountSelectorTrigger num={0} />
      </AccountSelectorProviderMirror>
    ),
    [],
  );
  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body space="$4">
        <SwapMainLand />
      </Page.Body>
    </Page>
  );
};

const Swap = () => {
  console.log('swap---111');
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0, 1]}
    >
      <SwapPage />
    </AccountSelectorProvider>
  );
};

export default Swap;
