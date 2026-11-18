import { useCallback, useEffect, useRef, useState } from 'react';

import { noop, throttle } from 'lodash';

import { useIsMounted } from '@onekeyhq/components/src/hocs/Provider/hooks/useIsMounted';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type {
  IConnectionAccountInfo,
  IConnectionStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePrevious } from '../../../hooks/usePrevious';
import { getWebviewWrapperRef } from '../utils/explorerUtils';

import { useWebTabDataById } from './useWebTabs';

import type {
  IHandleAccountChangedParams,
  IHandleAccountChangedResult,
} from '../../DAppConnection/hooks/useHandleAccountChanged';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

const notifyChanges = throttle((url: string, fromScene?: string) => {
  console.log('webview notify changed events: ', url, fromScene);
  const targetOrigin = uriUtils.getOriginFromUrl({ url });
  if (fromScene === 'domReady') {
    return;
  }
  if (targetOrigin) {
    void backgroundApiProxy.serviceDApp.notifyDAppAccountAndChainChangedWithCache(
      {
        targetOrigin,
      },
    );
  }
}, 800);

export function useDAppNotifyChangesBase({
  getWebviewRef,
  isFocused,
  url,
  shouldSkipNotify,
  tabId,
}: {
  getWebviewRef: () => IWebViewWrapperRef | null;
  isFocused: boolean; // isFocusedInDiscoveryTab
  url: string | undefined;
  shouldSkipNotify?: () => boolean;
  tabId?: string | null;
}) {
  const isMountedRef = useIsMounted();

  const getWebviewRefFn = useRef(getWebviewRef);
  getWebviewRefFn.current = getWebviewRef;

  const shouldSkipNotifyFn = useRef(shouldSkipNotify);
  shouldSkipNotifyFn.current = shouldSkipNotify;

  // reconnect jsBridge
  useEffect(() => {
    noop(isFocused, tabId);
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    const webviewRef = getWebviewRefFn.current();
    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    backgroundApiProxy.connectBridge(jsBridge as unknown as JsBridgeBase);
    return () => {
      backgroundApiProxy.connectBridge(null);
    };
  }, [isFocused, tabId]);

  // sent accountChanged notification
  useEffect(() => {
    if (shouldSkipNotifyFn.current?.() === true) {
      return;
    }

    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      console.log('not native or not desktop');
      return;
    }

    if (!isMountedRef.current) {
      console.log('not mounted');
      return;
    }

    if (!url || !isFocused) {
      console.log('no url or not focused');
      return;
    }

    const webviewRef = getWebviewRefFn.current();
    if (!webviewRef) {
      console.log('no webviewRef');
      return;
    }

    console.log('webview isFocused and notifyChanges: ', url);
    if (platformEnv.isDesktop) {
      const innerRef = webviewRef?.innerRef as IElectronWebView | undefined;

      if (!innerRef) {
        return;
      }
      // @ts-expect-error
      if (innerRef.__domReady) {
        notifyChanges(url, 'immediately');
      } else {
        const timer = setTimeout(() => {
          notifyChanges(url, 'setTimeout');
        }, 1000);
        const onDomReady = () => {
          notifyChanges(url, 'domReady');
          clearTimeout(timer);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          clearTimeout(timer);
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    } else if (platformEnv.isNative) {
      notifyChanges(url, 'immediately');
    }
  }, [isFocused, url, isMountedRef]);
}

export function useDAppNotifyChanges({ tabId }: { tabId: string | null }) {
  const { tab } = useWebTabDataById(tabId ?? '');

  const [isFocusedInDiscoveryTab, setIsFocusedInDiscoveryTab] = useState(false);
  useListenTabFocusState([ETabRoutes.MultiTabBrowser], (isFocus) => {
    setIsFocusedInDiscoveryTab(isFocus);
  });
  useListenTabFocusState([ETabRoutes.Discovery], (isFocus) => {
    if (platformEnv.isNative) {
      setIsFocusedInDiscoveryTab(isFocus);
    }
  });
  const previousUrl = usePrevious(tab?.url);

  const shouldSkipNotify = useCallback(() => {
    if (!tab?.url || !isFocusedInDiscoveryTab) {
      return true;
    }
    if (previousUrl && previousUrl !== tab.url) {
      const preUrlOrigin = uriUtils.getOriginFromUrl({ url: previousUrl });
      const curUrlOrigin = uriUtils.getOriginFromUrl({ url: tab.url });
      if (preUrlOrigin === curUrlOrigin) {
        return true;
      }
    }
    return false;
  }, [tab?.url, isFocusedInDiscoveryTab, previousUrl]);

  const getWebviewRef = useCallback(
    () => getWebviewWrapperRef(tabId ?? ''),
    [tabId],
  );
  useDAppNotifyChangesBase({
    getWebviewRef,
    url: tab?.url,
    isFocused: isFocusedInDiscoveryTab,
    shouldSkipNotify,
    tabId,
  });
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
      walletConnectTopic,
      accountSelectorNum,
      prevAccountInfo,
      accountChangedParams,
      storageType,
      afterUpdate,
    }: {
      origin: string;
      walletConnectTopic?: string;
      accountSelectorNum: number;
      prevAccountInfo: IConnectionAccountInfo;
      accountChangedParams: IHandleAccountChangedParams;
      storageType: IConnectionStorageType;
      afterUpdate: () => void;
    }): Promise<IHandleAccountChangedResult> => {
      const willUpdateAccountInfo =
        getAccountInfoByActiveAccount(accountChangedParams);
      if (
        !shouldUpdateConnectedAccount(prevAccountInfo, willUpdateAccountInfo)
      ) {
        return;
      }

      // Every path that re-points a live dApp session (browser toolbar,
      // CurrentConnectionModal, ConnectionList, network switch) funnels
      // through here. Apply the same backup gate as the connect approval so
      // an un-backed-up HD wallet, including one connected before this gate
      // existed, cannot expose a new address to the dApp (OK-63750).
      // checkIsWalletNotBackedUp is fail-closed for HD wallets.
      // shouldUpdateConnectedAccount already requires a wallet id; the
      // explicit guard keeps this fail-closed without a `?? ''` fallback.
      //
      // The selector state was committed before this handler ran, so on
      // rejection ask the caller to roll it back to the session's account and
      // refresh from the session so the UI matches what the dApp still sees.
      const { walletId } = willUpdateAccountInfo;
      if (
        !walletId ||
        (await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId,
        }))
      ) {
        afterUpdate();
        return { revertTo: prevAccountInfo };
      }

      const { serviceDApp } = backgroundApiProxy;
      await backgroundApiProxy.serviceDApp.updateConnectionSession({
        origin,
        walletConnectTopic,
        accountSelectorNum,
        updatedAccountInfo: willUpdateAccountInfo,
        storageType,
      });
      if (storageType === 'injectedProvider') {
        await backgroundApiProxy.serviceDApp.syncDappAccountIfPrimaryMode({
          origin,
        });
      }
      console.log(
        'useShouldUpdateConnectedAccount handleAccountChanged: ',
        accountSelectorNum,
        prevAccountInfo,
        accountChangedParams,
      );

      afterUpdate();

      if (
        storageType === 'injectedProvider' &&
        prevAccountInfo.accountId !== willUpdateAccountInfo.accountId
      ) {
        void serviceDApp.notifyDAppAccountsChanged(origin);
      }
      if (
        storageType === 'injectedProvider' &&
        prevAccountInfo.networkId !== willUpdateAccountInfo.networkId
      ) {
        void serviceDApp.notifyDAppChainChanged(origin);
      }
    },
    [getAccountInfoByActiveAccount, shouldUpdateConnectedAccount],
  );

  return {
    handleAccountInfoChanged,
  };
}
