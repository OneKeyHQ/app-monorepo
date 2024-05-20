import { useMemo } from 'react';

import { NavBackButton, Page } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';

export function HeaderLeft({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const items = useMemo(() => {
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      if (platformEnv.isNative) {
        return (
          <Page.Close>
            <NavBackButton />
          </Page.Close>
        );
      }
      return null;
    }

    const accountSelectorTrigger = (
      <AccountSelectorTriggerHome num={0} key="accountSelectorTrigger" />
    );
    return accountSelectorTrigger;
  }, [sceneName]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      {items}
    </AccountSelectorProviderMirror>
  );
}
