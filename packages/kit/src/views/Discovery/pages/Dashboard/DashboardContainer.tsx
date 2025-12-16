import { memo } from 'react';

import { Page } from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src//components/TabPageHeader';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import DashboardContent from './DashboardContent';

function BaseDashboard() {
  return (
    <>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Discovery}
      />
      <Page>
        <Page.Body>
          <DashboardContent />
        </Page.Body>
      </Page>
    </>
  );
}

const MemoizedBaseDashboard = memo(BaseDashboard);

function Dashboard() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MemoizedBaseDashboard />
    </AccountSelectorProviderMirror>
  );
}

export default withBrowserProvider(Dashboard);
