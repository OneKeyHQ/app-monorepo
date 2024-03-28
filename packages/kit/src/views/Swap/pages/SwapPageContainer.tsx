import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { AccountSelectorTriggerSwap } from '../../../components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerSwap';

import SwapMainLand from './components/SwapMainLand';

const SwapPageContainer = () => {
  const headerLeft = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
        enabledNum={[0]}
      >
        <AccountSelectorTriggerSwap num={0} />
      </AccountSelectorProviderMirror>
    ),
    [],
  );
  return (
    <Page scrollEnabled>
      <Page.Header headerLeft={headerLeft} />
      <Page.Body>
        <SwapMainLand />
      </Page.Body>
    </Page>
  );
};
export default SwapPageContainer;
