import { useCallback } from 'react';

import { ListView, Page } from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IConnectionItem,
  IConnectionProviderNames,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';

function ConnectionList() {
  const { simpleDb, serviceDApp } = backgroundApiProxy;
  const { result, run } = usePromiseResult(async () => {
    const rawData = await simpleDb.dappConnection.getRawData();
    return rawData?.data ?? [];
  }, [simpleDb]);

  const handleAccountInfoChanged = useCallback(
    async ({
      item,
      selectedAccount,
      scope,
    }: {
      item: IConnectionItem;
      selectedAccount: IAccountSelectorActiveAccountInfo;
      scope: IConnectionProviderNames;
    }) => {
      console.log('handleAccountChanged', item, selectedAccount, scope);
      const newConnectionItem: IConnectionItem = {
        ...item,
        connectionMap: {
          ...item.connectionMap,
          [scope]: {
            ...item.connectionMap[scope],
            walletId: selectedAccount.wallet?.id ?? '',
            indexedAccountId: selectedAccount.indexedAccount?.id ?? '',
            networkId: selectedAccount.network?.id ?? '',
            accountId: selectedAccount.account?.id ?? '',
          },
        },
      };
      await serviceDApp.saveConnectionSession(newConnectionItem);
      if (
        item.connectionMap[scope]?.accountId !== selectedAccount.account?.id
      ) {
        void serviceDApp.notifyDAppAccountsChanged(item.origin);
      }
      if (
        item.connectionMap[scope]?.networkId !== selectedAccount.network?.id
      ) {
        void serviceDApp.notifyDAppChainChanged(item.origin);
      }
    },
    [serviceDApp],
  );

  const handleDisconnect = useCallback(
    async ({
      origin,
      scope,
    }: {
      origin: string;
      scope: IConnectionProviderNames;
    }) => {
      await serviceDApp.disconnectAccount(origin, scope);
      void run();
    },
    [serviceDApp, run],
  );

  return (
    <Page>
      <Page.Header title="Connection List" />
      <Page.Body>
        <ListView
          data={result}
          estimatedItemSize="$10"
          // ListHeaderComponent={renderListHeader}
          keyExtractor={(item) => item.origin}
          renderItem={({ item }) => (
            <ConnectionListItem
              item={item}
              handleAccountInfoChanged={handleAccountInfoChanged}
              handleDisconnect={handleDisconnect}
            />
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
