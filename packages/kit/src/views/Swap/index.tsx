import { memo } from 'react';

import { Page, SizableText } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
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
          <AccountSelectorTrigger num={0} />
          <AccountSelectorActiveAccount num={0} />

          <AccountSelectorTrigger num={1} />
          <AccountSelectorActiveAccount num={1} />
        </AccountSelectorProviderMirror>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
