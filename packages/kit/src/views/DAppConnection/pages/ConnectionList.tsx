import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Empty,
  ListView,
  Page,
  SizableText,
} from '@onekeyhq/components';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IConnectionStorageType } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useShouldUpdateConnectedAccount } from '../../Discovery/hooks/useDAppNotifyChanges';
import { SETTINGS_PAGE_BODY_INSET_X } from '../../Setting/pages/Tab/settingsSurface';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';
import { WalletConnectDiagnosticsPanel } from '../components/WalletConnectDiagnosticsPanel';
import { DAppConnectionTestIDs } from '../testIDs';

const ItemSeparatorComponent = () => <Divider />;

function ConnectionListEmpty() {
  const intl = useIntl();
  return (
    <Empty
      flex={1}
      illustration="Connection"
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const renderHeaderTitle = useCallback(
    () => (
      <MultipleClickStack
        testID="dapp-connection-diagnostics-trigger"
        onPress={() => setShowDiagnostics(true)}
      >
        <SizableText size="$headingLg" numberOfLines={1}>
          {intl.formatMessage({ id: ETranslations.explore_dapp_connections })}
        </SizableText>
      </MultipleClickStack>
    ),
    [intl],
  );
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
        testID={DAppConnectionTestIDs.ConnectionListRemoveAllButton}
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
    <Page testID={DAppConnectionTestIDs.ConnectionList}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.explore_dapp_connections,
        })}
        headerTitle={renderHeaderTitle}
        headerRight={() => renderHeaderRight()}
      />
      <Page.Body px={SETTINGS_PAGE_BODY_INSET_X}>
        <ListView
          contentContainerStyle={{
            flex: platformEnv.isNative || showDiagnostics ? undefined : 1,
            pb: '$10',
          }}
          estimatedItemSize={199}
          scrollEnabled
          data={data}
          ListHeaderComponent={
            showDiagnostics ? <WalletConnectDiagnosticsPanel /> : null
          }
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
              }) =>
                handleAccountInfoChanged({
                  origin,
                  accountSelectorNum: num,
                  prevAccountInfo,
                  accountChangedParams: handleAccountChangedParams,
                  storageType: prevAccountInfo.storageType,
                  afterUpdate: () => run(),
                })
              }
            />
          )}
          ItemSeparatorComponent={ItemSeparatorComponent}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
