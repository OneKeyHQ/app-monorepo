import { memo } from 'react';

import { Page, SizableText } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccountLegacy,
  AccountSelectorProviderMirror,
  AccountSelectorTriggerLegacy,
} from '../../components/AccountSelector';

const Swap = () => {
  console.log('swap');

  return (
    <Page>
      <Page.Body space="$4">
        <SizableText>Swap</SizableText>
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.swap,
            sceneUrl: '',
          }}
          enabledNum={[0, 1]}
        >
          <AccountSelectorTriggerLegacy num={0} />
          <AccountSelectorActiveAccountLegacy num={0} />

          <AccountSelectorTriggerLegacy num={1} />
          <AccountSelectorActiveAccountLegacy num={1} />
        </AccountSelectorProviderMirror>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
