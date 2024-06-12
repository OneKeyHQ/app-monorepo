import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Divider, Empty, ListView, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  return (
    <Empty
      flex={1}
      icon="LinkSolid"
      title={intl.formatMessage({
        id: ETranslations.explore_no_dapps_connected,
      })}
      description={intl.formatMessage({
        id: ETranslations.explore_no_dapps_connected_message,
      })}
    />
  );
}

function ConnectionList() {
  const intl = useIntl();
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
    setData(() => {
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      return (result ?? []).slice(0, endIndex);
    });
  }, [result, page]);

  const loadMoreItems = useCallback(async () => {
    const nextPage = page + 1;
    const startIndex = nextPage * pageSize;
    const endIndex = startIndex + pageSize;
    const moreItems = (result ?? []).slice(startIndex, endIndex);

    if (moreItems.length > 0) {
      setData((currentData) => [...currentData, ...moreItems]);
      setPage(nextPage);
    }
  }, [result, page]);

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
        {intl.formatMessage({ id: ETranslations.explore_remove_all })}
      </Button>
    ),
    [run, serviceDApp, intl],
  );

  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.explore_dapp_connections,
        })}
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
