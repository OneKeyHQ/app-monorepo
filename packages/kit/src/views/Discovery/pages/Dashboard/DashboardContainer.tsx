import { useCallback, useMemo } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';

import { CustomHeaderTitle } from '../../components/CustomHeaderTitle';

import { DashboardContent } from './DashboardContent';

function Dashboard() {
  const text = useMemo(() => 'Text', []);

  const headerTitle = useCallback(() => <CustomHeaderTitle />, []);

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        <Stack>
          <SizableText>{text}</SizableText>
          <DashboardContent />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default Dashboard;
