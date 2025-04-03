import { useMemo } from 'react';

import { Page, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import { HeaderRight } from '@onekeyhq/kit/src/components/TabPageHeader/HeaderRight';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DashboardContent from './DashboardContent';

function Dashboard() {
  const { top } = useSafeAreaInsets();
  const historyButton = useMemo(
    () =>
      !platformEnv.isExtension && !platformEnv.isWeb
        ? () => {
            return (
              <HeaderRight sceneName={EAccountSelectorSceneName.discover}>
                <HistoryIconButton />
              </HeaderRight>
            );
          }
        : undefined,
    [],
  );

  return (
    <Page>
      <Page.Header headerRight={historyButton} />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}
      {platformEnv.isNativeIOS ? (
        <XStack pt={top} px="$5" width="100%" justifyContent="flex-end">
          <HistoryIconButton />
        </XStack>
      ) : null}
      <Page.Body>
        <DashboardContent />
        {platformEnv.isNativeIOSPad ? <MobileBrowserBottomBar id="" /> : null}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(Dashboard);
