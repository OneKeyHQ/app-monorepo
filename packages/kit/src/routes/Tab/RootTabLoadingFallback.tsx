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
};

export function RootTabLoadingFallback({
  tabRoute,
  sceneName = EAccountSelectorSceneName.home,
  enabledNum = DEFAULT_ENABLED_NUM,
}: IRootTabLoadingFallbackProps) {
  const media = useMedia();

  if (platformEnv.isNative || media.md) {
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
      <LoadingSpinner />
    </AccountSelectorProviderMirror>
  );
}
