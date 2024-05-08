import { useMemo } from 'react';

import { NavBackButton, Page } from '@onekeyhq/components';
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
    const accountSelectorTrigger = (
      <AccountSelectorTriggerHome num={0} key="accountSelectorTrigger" />
    );
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <Page.Close>
          <NavBackButton />
        </Page.Close>
      );
    }
    return [accountSelectorTrigger];
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
