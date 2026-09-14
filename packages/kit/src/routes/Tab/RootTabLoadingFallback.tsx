import type { ReactNode } from 'react';

import { Page, Spinner, Stack, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';

function LoadingSpinner() {
  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

const DEFAULT_ENABLED_NUM = [0];

type IRootTabLoadingFallbackProps = {
  tabRoute: ETabRoutes;
  sceneName?: EAccountSelectorSceneName;
  enabledNum?: number[];
  mobileContentFallback?: ReactNode;
};

export function RootTabLoadingFallback({
  tabRoute,
  sceneName = EAccountSelectorSceneName.home,
  enabledNum = DEFAULT_ENABLED_NUM,
  mobileContentFallback,
}: IRootTabLoadingFallbackProps) {
  const media = useMedia();

  if (platformEnv.isNative || (media.md && !mobileContentFallback)) {
    return (
      <>
        <Page.Header headerShown={false} />
        <LoadingSpinner />
      </>
    );
  }

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={enabledNum}
    >
      <TabPageHeader sceneName={sceneName} tabRoute={tabRoute} />
      {media.md && mobileContentFallback ? (
        mobileContentFallback
      ) : (
        <LoadingSpinner />
      )}
    </AccountSelectorProviderMirror>
  );
}
