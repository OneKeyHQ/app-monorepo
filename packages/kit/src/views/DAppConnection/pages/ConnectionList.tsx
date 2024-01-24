import { useCallback } from 'react';

import { ListView, Page } from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import ConnectionListItem from '../components/ConnectionList/ConnectionListItem';

function ConnectionList() {
  const { serviceDApp } = backgroundApiProxy;
  const { result, run } = usePromiseResult(async () => {
    const r = await serviceDApp.getInjectProviderConnectedList();
    return r;
  }, [serviceDApp]);

  const shouldUpdateSession = useCallback(
    (
      prevAccountInfo: IConnectionAccountInfo,
      accountInfo: IConnectionAccountInfo,
    ): boolean =>
      prevAccountInfo &&
      (prevAccountInfo.walletId !== accountInfo.walletId ||
        prevAccountInfo.indexedAccountId !== accountInfo.indexedAccountId ||
        prevAccountInfo.networkId !== accountInfo.networkId ||
        prevAccountInfo.accountId !== accountInfo.accountId ||
        prevAccountInfo.address !== accountInfo.address),
    [],
  );

  const handleAccountInfoChanged = useCallback(
    async ({
      origin,
      accountSelectorNum,
      prevAccountInfo,
      selectedAccount,
    }: {
      origin: string;
      accountSelectorNum: number;
      prevAccountInfo: IConnectionAccountInfo;
      selectedAccount: IAccountSelectorActiveAccountInfo;
    }) => {
      console.log(
        'handleAccountChanged: ',
        accountSelectorNum,
        prevAccountInfo,
        selectedAccount,
      );
      const updatedAccountInfo: IConnectionAccountInfo = {
        walletId: selectedAccount.wallet?.id ?? '',
        indexedAccountId: selectedAccount.indexedAccount?.id ?? '',
        networkId: selectedAccount.network?.id ?? '',
        accountId: selectedAccount.account?.id ?? '',
        address: selectedAccount.account?.address ?? '',
        networkImpl: selectedAccount.network?.impl ?? '',
      };
      if (!shouldUpdateSession(prevAccountInfo, updatedAccountInfo)) {
        return;
      }

      await serviceDApp.updateConnectionSession({
        origin,
        accountSelectorNum,
        updatedAccountInfo,
        storageType: 'injectedProvider',
      });

      void run();

      if (prevAccountInfo.accountId !== updatedAccountInfo.accountId) {
        void serviceDApp.notifyDAppAccountsChanged(origin);
      }
      if (prevAccountInfo.networkId !== updatedAccountInfo.networkId) {
        void serviceDApp.notifyDAppChainChanged(origin);
      }
    },
    [serviceDApp, shouldUpdateSession, run],
  );

  const handleDisconnect = useCallback(
    async ({
      origin,
      networkImpl,
      accountSelectorNum,
    }: {
      origin: string;
      networkImpl: string;
      accountSelectorNum: number;
    }) => {
      await serviceDApp.disconnectAccount({
        origin,
        options: { networkImpl },
        num: accountSelectorNum,
      });
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
