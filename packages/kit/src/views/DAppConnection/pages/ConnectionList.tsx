import { useCallback } from 'react';

import { Button, Empty, ListView, Page } from '@onekeyhq/components';
import type { IStorageType } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';

function ConnectionListEmpty() {
  return (
    <Empty
      flex={1}
      icon="LinkSolid"
      title="No dApps Connected"
      description="You haven't connected to any dApps yet. "
    />
  );
}

function ConnectionList() {
  const { result, run } = usePromiseResult(
    async () => backgroundApiProxy.serviceDApp.getAllConnectedList(),
    [],
  );

  const handleDAppDisconnect = useCallback(
    async (origin: string, storageType: IStorageType) => {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin,
        storageType,
      });
      void run();
    },
    [run],
  );

  const renderHeaderRight = useCallback(
    () => (
      <Button
        variant="tertiary"
        size="medium"
        onPress={async () => {
          await backgroundApiProxy.serviceDApp.disconnectAllWebsites();
          void run();
        }}
      >
        Remove All
      </Button>
    ),
    [run],
  );

  return (
    <Page>
      <Page.Header
        title="dApp connections"
        headerRight={() => renderHeaderRight()}
      />
      <Page.Body>
        <ListView
          contentContainerStyle={{
            flex: 1,
          }}
          estimatedItemSize={48}
          scrollEnabled
          data={result}
          ListEmptyComponent={ConnectionListEmpty}
          keyExtractor={(item) => item.origin}
          renderItem={({ item }) => (
            <ConnectionListItem
              item={item}
              handleDisconnect={handleDAppDisconnect}
            />
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
