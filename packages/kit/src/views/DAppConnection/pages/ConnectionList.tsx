import { useCallback, useEffect, useState } from 'react';

import { Button, Divider, Empty, ListView, Page } from '@onekeyhq/components';
import type {
  IConnectionItemWithStorageType,
  IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useShouldUpdateConnectedAccount } from '../../Discovery/hooks/useDAppNotifyChanges';
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
  const [data, setData] = useState<IConnectionItemWithStorageType[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const { result, run } = usePromiseResult(
    async () => serviceDApp.getAllConnectedList(),
    [serviceDApp],
    {
      checkIsFocused: false,
    },
  );

  useEffect(() => {
    const loadInitialData = async () => {
      const fullList = await serviceDApp.getAllConnectedList();
      setData(fullList.slice(0, pageSize));
    };

    void loadInitialData();
  }, [serviceDApp]);

  const loadMoreItems = useCallback(async () => {
    const nextPage = page + 1;
    const startIndex = nextPage * pageSize;
    const endIndex = startIndex + pageSize;
    const moreItems = (result ?? []).slice(startIndex, endIndex);

    if (moreItems.length > 0) {
      setData([...data, ...moreItems]);
      setPage(nextPage);
    }
  }, [result, data, page]);

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

  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();

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
          data={data}
          ListEmptyComponent={ConnectionListEmpty}
          keyExtractor={(item) => item.origin}
          renderItem={({ item }) => (
            <ConnectionListItem
              item={item}
              handleDisconnect={handleDAppDisconnect}
              handleAccountChanged={({
                origin,
                num,
                handleAccountChangedParams,
                prevAccountInfo,
              }) => {
                void handleAccountInfoChanged({
                  origin,
                  accountSelectorNum: num,
                  prevAccountInfo,
                  accountChangedParams: handleAccountChangedParams,
                  storageType: prevAccountInfo.storageType,
                  afterUpdate: () => run(),
                });
              }}
            />
          )}
          ItemSeparatorComponent={ItemSeparatorComponent}
          onEndReached={() => {
            void loadMoreItems();
          }}
          onEndReachedThreshold={1}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
