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

import type { IHandleAccountChangedParams } from '../../DAppConnection/hooks/useHandleAccountChanged';
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
}: {
  getWebviewRef: () => IWebViewWrapperRef | null;
  isFocused: boolean; // isFocusedInDiscoveryTab
  url: string | undefined;
  shouldSkipNotify?: () => boolean;
}) {
  const isMountedRef = useIsMounted();

  const getWebviewRefFn = useRef(getWebviewRef);
  getWebviewRefFn.current = getWebviewRef;

  const shouldSkipNotifyFn = useRef(shouldSkipNotify);
  shouldSkipNotifyFn.current = shouldSkipNotify;

  // reconnect jsBridge
  useEffect(() => {
    noop(isFocused);
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    const webviewRef = getWebviewRefFn.current();
    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    backgroundApiProxy.connectBridge(jsBridge as unknown as JsBridgeBase);
  }, [isFocused]);

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
      if (innerRef.__dy) {
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

  const webviewRef = getWebviewWrapperRef(tabId ?? '');
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

  const getWebviewRef = useCallback(() => webviewRef, [webviewRef]);
  useDAppNotifyChangesBase({
    getWebviewRef,
    url: tab?.url,
    isFocused: isFocusedInDiscoveryTab,
    shouldSkipNotify,
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
      await backgroundApiProxy.serviceDApp.syncDappAccountIfPrimaryMode({
        origin,
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
