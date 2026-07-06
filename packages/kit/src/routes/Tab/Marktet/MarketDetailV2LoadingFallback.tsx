import { Page, Spinner, Stack, useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { TabPageHeader } from '../../../components/TabPageHeader';

function LoadingSpinner() {
  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

export function MarketDetailV2LoadingFallback() {
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
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <LoadingSpinner />
    </AccountSelectorProviderMirror>
  );
}
