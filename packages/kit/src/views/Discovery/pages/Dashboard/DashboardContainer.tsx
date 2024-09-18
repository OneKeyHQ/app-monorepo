import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import CustomHeaderSearch from '../../components/CustomHeaderSearch';
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

  return (
    <Page>
      <Page.Header headerRight={headerRight} />
      <Page.Body>
        <DashboardContent />
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(Dashboard);
