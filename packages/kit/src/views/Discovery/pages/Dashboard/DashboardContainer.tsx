import { Page } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import DashboardContent from './DashboardContent';

function Dashboard() {
  return (
    <Page>
      <Page.Header />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}

      <Page.Body>
        <DashboardContent />
        {platformEnv.isNativeIOSPad ? <MobileBrowserBottomBar id="" /> : null}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(Dashboard);
