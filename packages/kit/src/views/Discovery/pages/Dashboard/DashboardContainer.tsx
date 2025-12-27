import { memo } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src//components/TabPageHeader';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorProvider';
import { LazyPageContainer } from '@onekeyhq/kit/src/components/LazyPageContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import Browser from '../Browser/Browser';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import DashboardContent from './DashboardContent';

function BaseDashboard() {
  return (
    <LazyPageContainer>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Discovery}
      />
      <Page>
        <Page.Body>
          <DashboardContent />
        </Page.Body>
      </Page>
    </LazyPageContainer>
  );
}

const MemoizedBaseDashboard = memo(BaseDashboard);

function Dashboard() {
  const media = useMedia();
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      {platformEnv.isExtension && media.md ? (
        <Browser />
      ) : (
        <MemoizedBaseDashboard />
      )}
    </AccountSelectorProviderMirror>
  );
}

export default withBrowserProvider(Dashboard);
