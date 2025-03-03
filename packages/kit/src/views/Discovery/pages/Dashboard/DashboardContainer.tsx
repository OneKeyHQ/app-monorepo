import { useCallback } from 'react';

import { Page, Stack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';
import { BrowserTitle } from '../components/BrowserTitle';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DashboardContent from './DashboardContent';

function Dashboard() {
  const { top } = useSafeAreaInsets();
  const renderHeaderLeft = useCallback(() => <BrowserTitle />, []);

  return (
    <Page>
      <Page.Header
        headerLeft={renderHeaderLeft}
        headerRight={HistoryIconButton}
      />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}
      {platformEnv.isNativeIOS ? (
        <Stack
          pt={top}
          px="$5"
          width="100%"
          position="relative"
          justifyContent="space-between"
        >
          <BrowserTitle />

          <Stack position="absolute" right="$5" pt={top}>
            <HistoryIconButton />
          </Stack>
        </Stack>
      ) : null}
      <Page.Body>
        <DashboardContent />
        {platformEnv.isNativeIOSPad ? <MobileBrowserBottomBar id="" /> : null}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(Dashboard);
