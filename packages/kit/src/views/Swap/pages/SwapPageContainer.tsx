import { useCallback } from 'react';

import { Page, XStack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerSwap,
} from '../../../components/AccountSelector';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';
import SwapMainLand from './SwapMainLand';

const SwapPageContainer = () => {
  const headerRight = useCallback(
    () => (
      <XStack>
        <AccountSelectorProviderMirror
          config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
          enabledNum={[1]}
        >
          <AccountSelectorTriggerSwap num={1} />
        </AccountSelectorProviderMirror>
        <SwapHeaderRightActionContainer />
      </XStack>
    ),
    [],
  );
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
