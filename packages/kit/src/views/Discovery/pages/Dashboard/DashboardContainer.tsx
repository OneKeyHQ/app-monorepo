import { useMemo } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';

import { DashboardContent } from './DashboardContent';

function Dashboard() {
  const text = useMemo(() => 'Text', []);

  return (
    <Page>
      <Page.Header title="Dashboard" />
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
