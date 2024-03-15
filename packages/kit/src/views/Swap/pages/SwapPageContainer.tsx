import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { AccountSelectorTriggerSwap } from '../../../components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerSwap';

import SwapHeaderRightActionContainer from './components/SwapHeaderRightActionContainer';
import SwapMainLand from './components/SwapMainLand';

const SwapPageContainer = () => {
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);
  const headerTitle = useCallback(
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
    <Page>
      <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
      <Page.Body space="$4">
        <SwapMainLand />
      </Page.Body>
    </Page>
  );
};
export default SwapPageContainer;
