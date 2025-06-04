import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../AccountSelector';

import { UrlAccountPageHeader } from './urlAccountPageHeader';

export function HeaderTitle({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const item = useMemo(() => {
    if (
      !platformEnv.isNativeIOS &&
      sceneName === EAccountSelectorSceneName.homeUrlAccount
    ) {
      return <UrlAccountPageHeader />;
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
