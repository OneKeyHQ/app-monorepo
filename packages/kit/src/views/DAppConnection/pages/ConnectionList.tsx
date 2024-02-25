import { useCallback } from 'react';

import { Button, Divider, Empty, ListView, Page } from '@onekeyhq/components';
import type { IConnectionStorageType } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';

const ItemSeparatorComponent = () => <Divider />;

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
  const { serviceDApp } = backgroundApiProxy;
  const { result, run } = usePromiseResult(
    async () => serviceDApp.getAllConnectedList(),
    [serviceDApp],
  );

  const handleDAppDisconnect = useCallback(
    async (origin: string, storageType: IConnectionStorageType) => {
      await serviceDApp.disconnectWebsite({
        origin,
        storageType,
      });
      void run();
    },
    [run, serviceDApp],
  );

  const renderHeaderRight = useCallback(
    () => (
      <Button
        variant="tertiary"
        size="medium"
        onPress={async () => {
          await serviceDApp.disconnectAllWebsites();
          void run();
        }}
      >
        Remove All
      </Button>
    ),
    [run, serviceDApp],
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
          ItemSeparatorComponent={ItemSeparatorComponent}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
