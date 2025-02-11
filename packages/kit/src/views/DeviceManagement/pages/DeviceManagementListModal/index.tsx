import { useMemo } from 'react';

import { Page } from '@onekeyhq/components';

function DeviceManagementListModal() {
  const content = useMemo(() => 'Hello World', []);

  return (
    <Page>
      <Page.Header title="Modal Title" />
      <Page.Body>{content}</Page.Body>
      <Page.Footer
        onConfirmText="Connect"
        onCancelText="Cancel"
        onConfirm={() => console.log('onConfirm')}
        onCancel={() => console.log('onCancel')}
      />
    </Page>
  );
}

export default DeviceManagementListModal;
