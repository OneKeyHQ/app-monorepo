import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';

import SwapMainLand from './SwapMainLand';

const SwapPageContainer = () => {
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{ sceneName: EAccountSelectorSceneName.swap, sceneUrl: '' }}
      >
        <AccountSelectorTriggerHome num={0} />
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
export default SwapPageContainer;
