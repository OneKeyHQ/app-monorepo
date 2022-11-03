import { useEffect, useMemo } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { throttle } from 'lodash';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { getWebviewWrapperRef } from '../explorerUtils';

import { useWebTab } from './useWebTabs';

const notifyChanges = throttle(
  (url: string, fromScene?: string) => {
    debugLogger.webview.info('webview notify changed events', url, fromScene);
    backgroundApiProxy.serviceAccount.notifyAccountsChanged();
    backgroundApiProxy.serviceNetwork.notifyChainChanged();
  },
  150,
  {
    leading: false,
    trailing: true,
  },
);

export const useNotifyChanges = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation();

  const isFocusedInDiscoverTab = useMemo(() => {
    let $isFocused = isFocused;
    if (!isFocused) {
      // getFocusedRouteNameFromRoute(route)
      let tabNav = navigation;
      if (tabNav.getState().type !== 'tab') {
        tabNav = navigation.getParent();
      }
      const { routeNames, index: navIndex } = tabNav.getState();
      $isFocused = (routeNames[navIndex] as string) === 'discover';
    }
    return $isFocused;
  }, [isFocused, navigation]);

  const isMountedRef = useIsMounted();
  const tab = useWebTab();

  const tabUrl = tab?.url;
  const tabId = tab?.id;

  const webviewRef = getWebviewWrapperRef({
    tabId,
  });
  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }

    const jsBridge = webviewRef?.jsBridge;
    if (!jsBridge) {
      return;
    }
    // only enable message for current focused webview
    jsBridge.globalOnMessageEnabled = true;
    // connect background jsBridge
    backgroundApiProxy.connectBridge(jsBridge);
  }, [webviewRef]);

  useEffect(() => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    if (!tabUrl || !isFocusedInDiscoverTab) {
      return;
    }
    if (!webviewRef) {
      return;
    }
    debugLogger.webview.info('webview isFocused and notifyChanges', tabUrl);

    if (platformEnv.isNative) {
      notifyChanges(tabUrl, 'immediately');
    } else {
      const innerRef = webviewRef?.innerRef as IElectronWebView | undefined;

      if (!innerRef) {
        return;
      }
      // @ts-ignore
      if (innerRef.__domReady) {
        notifyChanges(tabUrl, 'immediately');
      } else {
        const timer = setTimeout(() => {
          notifyChanges(tabUrl, 'setTimeout');
        }, 1000);
        const onDomReady = () => {
          notifyChanges(tabUrl, 'domReady');
          clearTimeout(timer);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          clearTimeout(timer);
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    }
  }, [isFocusedInDiscoverTab, isMountedRef, tabUrl, webviewRef]);
};
