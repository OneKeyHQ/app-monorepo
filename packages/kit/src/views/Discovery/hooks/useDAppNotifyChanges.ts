import { useCallback, useEffect, useState } from 'react';

import { throttle } from 'lodash';

import { useIsMounted } from '@onekeyhq/components/src/hocs/Provider/hooks/useIsMounted';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IConnectionAccountInfo,
  IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePrevious } from '../../../hooks/usePrevious';
import { getWebviewWrapperRef } from '../utils/explorerUtils';

import { useWebTabDataById } from './useWebTabs';

import type { IHandleAccountChangedParams } from '../../DAppConnection/hooks/useHandleAccountChanged';

const notifyChanges = throttle(
  (url: string, fromScene?: string) => {
    console.log('webview notify changed events: ', url, fromScene);
    const targetOrigin = new URL(url).origin;
    void backgroundApiProxy.serviceDApp.notifyDAppAccountsChanged(targetOrigin);
    void backgroundApiProxy.serviceDApp.notifyDAppChainChanged(targetOrigin);
  },
  800,
  {
    leading: true,
    trailing: false,
  },
);

export function useDAppNotifyChanges({ tabId }: { tabId: string | null }) {
  const isMountedRef = useIsMounted();
  const { tab } = useWebTabDataById(tabId ?? '');

  const webviewRef = getWebviewWrapperRef(tabId ?? '');
  const [isFocusedInDiscoveryTab, setIsFocusedInDiscoveryTab] = useState(false);
  useListenTabFocusState([ETabRoutes.MultiTabBrowser], (isFocus) => {
    setIsFocusedInDiscoveryTab(isFocus);
  });
  const previousUrl = usePrevious(tab?.url);

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

  // sent accountChanged notification
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      console.log('not native or not desktop');
      return;
    }

    if (!isMountedRef.current) {
      console.log('not mounted');
      return;
    }

    if (!tab?.url || !isFocusedInDiscoveryTab) {
      console.log('no url or not focused');
      return;
    }

    if (!webviewRef) {
      console.log('no webviewRef');
      return;
    }

    if (previousUrl && previousUrl !== tab.url) {
      const preUrl = new URL(previousUrl);
      const curUrl = new URL(tab.url);
      if (preUrl.origin === curUrl.origin) {
        return;
      }
    }

    console.log('webview isFocused and notifyChanges: ', tab.url);
    if (platformEnv.isDesktop) {
      const innerRef = webviewRef?.innerRef as IElectronWebView | undefined;

      if (!innerRef) {
        return;
      }
      // @ts-expect-error
      if (innerRef.__dy) {
        notifyChanges(tab.url, 'immediately');
      } else {
        const timer = setTimeout(() => {
          notifyChanges(tab.url, 'setTimeout');
        }, 1000);
        const onDomReady = () => {
          notifyChanges(tab.url, 'domReady');
          clearTimeout(timer);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          clearTimeout(timer);
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    }
  }, [isFocusedInDiscoveryTab, tab.url, webviewRef, isMountedRef, previousUrl]);
}

export function useShouldUpdateConnectedAccount() {
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
    },
    [getAccountInfoByActiveAccount, shouldUpdateConnectedAccount],
  );

  return {
    handleAccountInfoChanged,
  };
}
