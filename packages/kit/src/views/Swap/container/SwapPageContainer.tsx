import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerSwap,
} from '../../../components/AccountSelector';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';
import SwapMainLand from './SwapMainLand';

const SwapPageContainer = () => {
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
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
