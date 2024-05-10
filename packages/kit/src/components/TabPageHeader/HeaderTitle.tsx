import { useMemo } from 'react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import { AccountSelectorProviderMirror } from '../AccountSelector';

export function HeaderTitle({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const item = useMemo(() => {
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return <UrlAccountNavHeader.Address key="urlAccountNavHeaderAddress" />;
    }
  }, [sceneName]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      {item}
    </AccountSelectorProviderMirror>
  );
}
