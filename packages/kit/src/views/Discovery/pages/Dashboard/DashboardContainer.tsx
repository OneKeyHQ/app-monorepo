import { Page, Stack, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';
import { BrowserTitle } from '../components/BrowserTitle';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DashboardContent from './DashboardContent';

function Dashboard() {
  const { top } = useSafeAreaInsets();

  return (
    <Page>
      <Page.Header headerLeft={BrowserTitle} headerRight={HistoryIconButton} />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}
      {platformEnv.isNativeIOS ? (
        <XStack px="$5" pt={top} justifyContent="space-between">
          <Stack flex={1} pl="$5" alignItems="center">
            <BrowserTitle />
          </Stack>
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
