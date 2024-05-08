import { useMemo } from 'react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
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
      return [<UrlAccountNavHeader.Address key="urlAccountNavHeaderAddress" />];
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
