import { useCallback } from 'react';

import { Page, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import CustomHeaderSearch from '../../components/CustomHeaderSearch';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import DashboardContent from './DashboardContent';

function Dashboard() {
  const navigation = useAppNavigation();
  const handleSearchBarPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [navigation]);

  const headerRight = useCallback(
    () => <CustomHeaderSearch handleSearchBarPress={handleSearchBarPress} />,
    [handleSearchBarPress],
  );
  const { top } = useSafeAreaInsets();

  return (
    <Page>
      <Page.Header headerRight={headerRight} />
      {platformEnv.isNativeIOSPad ? <HandleRebuildBrowserData /> : null}
      {platformEnv.isNativeIOS ? (
        <XStack px="$5" pt={top}>
          {headerRight()}
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
