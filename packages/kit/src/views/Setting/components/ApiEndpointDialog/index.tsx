import { Dialog } from '@onekeyhq/components';

import { ApiEndpointList } from './components/ApiEndpointList';

export function showApiEndpointDialog() {
  Dialog.show({
    title: 'API Endpoint Management',
    renderContent: (
      <ApiEndpointList
        onRefresh={() => {
          // Data will be refreshed automatically through usePromiseResult
        }}
      />
    ),
    showFooter: false,
  });
}
