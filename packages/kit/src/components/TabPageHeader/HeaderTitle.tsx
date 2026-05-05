import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../AccountSelector';

import { UrlAccountPageHeader } from './urlAccountPageHeader';

export function HeaderTitle({
  sceneName,
  children,
}: {
  sceneName: EAccountSelectorSceneName;
  children?: ReactNode;
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
    return children;
  }, [md, sceneName, children]);

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
