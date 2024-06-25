import { useCallback, useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IConnectionAccountInfo,
  IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { getWebviewWrapperRef } from '../utils/explorerUtils';

import { useWebTabs } from './useWebTabs';

import type { IHandleAccountChangedParams } from '../../DAppConnection/hooks/useHandleAccountChanged';

export function useDAppNotifyChanges({ tabId }: { tabId: string | null }) {
  const webviewRef = getWebviewWrapperRef(tabId ?? '');
  const [isFocusedInDiscoveryTab, setIsFocusedInDiscoveryTab] = useState(false);
  useListenTabFocusState([ETabRoutes.MultiTabBrowser], (isFocus) => {
    setIsFocusedInDiscoveryTab(isFocus);
  });

  // reconnect jsBridge
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    backgroundApiProxy.connectBridge(jsBridge);
  }, [webviewRef, isFocusedInDiscoveryTab]);
}

export function useShouldUpdateConnectedAccount() {
  const { tabs } = useWebTabs();

  const shouldUpdateConnectedAccount = useCallback(
    (
      prevAccountInfo: IConnectionAccountInfo,
      accountInfo: IConnectionAccountInfo,
    ) => {
      const hasAccountChanged =
        prevAccountInfo.walletId !== accountInfo.walletId ||
        prevAccountInfo.indexedAccountId !== accountInfo.indexedAccountId ||
        prevAccountInfo.networkId !== accountInfo.networkId ||
        prevAccountInfo.accountId !== accountInfo.accountId ||
        prevAccountInfo.address !== accountInfo.address;

      const isValidAccountInfo =
        accountInfo.accountId &&
        accountInfo.walletId &&
        (networkUtils.isLightningNetworkByNetworkId(accountInfo.networkId) ||
          accountInfo.address) &&
        accountInfo.networkId;

      return prevAccountInfo && hasAccountChanged && isValidAccountInfo;
    },
    [],
  );

  const getAccountInfoByActiveAccount = useCallback(
    ({ activeAccount, selectedAccount }: IHandleAccountChangedParams) => {
      const updatedAccountInfo: IConnectionAccountInfo = {
        walletId: activeAccount.wallet?.id ?? '',
        indexedAccountId: activeAccount.indexedAccount?.id ?? '',
        networkId: activeAccount.network?.id ?? '',
        accountId: activeAccount.account?.id ?? '',
        address: activeAccount.account?.address ?? '',
        networkImpl: activeAccount.network?.impl ?? '',
        deriveType: activeAccount.deriveType,

        focusedWallet: selectedAccount.focusedWallet,
        othersWalletAccountId: selectedAccount.othersWalletAccountId,
      };
      return updatedAccountInfo;
    },
    [],
  );

  const handleAccountInfoChanged = useCallback(
    async ({
      origin,
      accountSelectorNum,
      prevAccountInfo,
      accountChangedParams,
      storageType,
      afterUpdate,
    }: {
      origin: string;
      accountSelectorNum: number;
      prevAccountInfo: IConnectionAccountInfo;
      accountChangedParams: IHandleAccountChangedParams;
      storageType: IConnectionStorageType;
      afterUpdate: () => void;
    }) => {
      const willUpdateAccountInfo =
        getAccountInfoByActiveAccount(accountChangedParams);
      if (
        !shouldUpdateConnectedAccount(prevAccountInfo, willUpdateAccountInfo)
      ) {
        return;
      }

      const { serviceDApp } = backgroundApiProxy;
      await backgroundApiProxy.serviceDApp.updateConnectionSession({
        origin,
        accountSelectorNum,
        updatedAccountInfo: willUpdateAccountInfo,
        storageType,
      });
      console.log(
        'useShouldUpdateConnectedAccount handleAccountChanged: ',
        accountSelectorNum,
        prevAccountInfo,
        accountChangedParams,
      );

      afterUpdate();

      if (prevAccountInfo.accountId !== willUpdateAccountInfo.accountId) {
        void serviceDApp.notifyDAppAccountsChanged(origin);
      }
      if (prevAccountInfo.networkId !== willUpdateAccountInfo.networkId) {
        void serviceDApp.notifyDAppChainChanged(origin);
      }

      tabs.forEach((tab) => {
        const url = new URL(tab.url);
        if (url.origin === origin && !tab.isActive) {
          tab.shouldReload = true;
        }
      });
    },
    [getAccountInfoByActiveAccount, shouldUpdateConnectedAccount, tabs],
  );

  return {
    handleAccountInfoChanged,
  };
}
