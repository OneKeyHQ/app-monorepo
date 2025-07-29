import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Divider, Empty, ListView, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IConnectionStorageType } from '@onekeyhq/shared/types/dappConnection';

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

const { serviceDApp } = backgroundApiProxy;

function ConnectionList() {
  const intl = useIntl();
  const { result: data, run } = usePromiseResult(
    async () => serviceDApp.getAllConnectedList(),
    [],
    {
      initResult: [],
      checkIsFocused: false,
    },
  );

  const handleDAppDisconnect = useCallback(
    async (origin: string, storageType: IConnectionStorageType) => {
      await serviceDApp.disconnectWebsite({
        origin,
        storageType,
        entry: 'SettingModal',
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
          await serviceDApp.disconnectAllWebsites();
          void run();
        }}
      >
        {intl.formatMessage({ id: ETranslations.explore_remove_all })}
      </Button>
    ),
    [run, intl],
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
            flex: platformEnv.isNative ? undefined : 1,
            pb: '$10',
          }}
          estimatedItemSize={199}
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
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
