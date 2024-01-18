import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';

import { CustomHeaderTitle } from '../../components/CustomHeaderTitle';

import DashboardContent from './DashboardContent';

function Dashboard() {
  const headerTitle = useCallback(() => <CustomHeaderTitle />, []);

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        <DashboardContent />
      </Page.Body>
    </Page>
  );
}

export default Dashboard;
