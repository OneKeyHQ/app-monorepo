import { useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../AccountSelector';

import { UrlAccountPageHeader } from './urlAccountPageHeader';

export function HeaderTitle({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const { md } = useMedia();
  const item = useMemo(() => {
    if (
      !platformEnv.isNativeIOS &&
      (!platformEnv.isWebDappMode || (platformEnv.isWebDappMode && md)) &&
      sceneName === EAccountSelectorSceneName.homeUrlAccount
    ) {
      return <UrlAccountPageHeader />;
    }
  }, [md, sceneName]);

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
