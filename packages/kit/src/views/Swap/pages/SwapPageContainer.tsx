import {
  Page,
  useIsTabletDetailView,
  useOrientation,
} from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';

import SwapMainLandWithPageType from './components/SwapMainLand';

const SwapPageContainer = () => {
  useDebugComponentRemountLog({ name: 'SwapPageContainer' });
  const isTabletDetailView = useIsTabletDetailView();
  const isLandscape = useOrientation();
  if (isTabletDetailView && isLandscape) {
    return <TabletHomeContainer />;
  }
  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.swap}
        tabRoute={ETabRoutes.Swap}
      />
      <Page.Body>
        <SwapMainLandWithPageType />
      </Page.Body>
    </Page>
  );
};
export default SwapPageContainer;
