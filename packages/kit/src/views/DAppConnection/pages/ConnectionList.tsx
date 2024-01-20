import { useCallback } from 'react';

import {
  Button,
  ListItem,
  ListView,
  Page,
  SizableText,
} from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IConnectionItem,
  IConnectionProviderNames,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';

function ConnectionList() {
  const { result } = usePromiseResult(async () => {
    const rawData =
      await backgroundApiProxy.simpleDb.dappConnection.getRawData();
    return rawData?.data ?? [];
  }, []);

  const handleAccountInfoChanged = useCallback(
    ({
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
      void backgroundApiProxy.serviceDApp.saveConnectionSession(
        newConnectionItem,
      );
    },
    [],
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
            />
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default ConnectionList;
