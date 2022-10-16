import { useEffect } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { webviewRefs } from '../explorerUtils';

import { useWebTab } from './useWebTabs';

const notifyChanges = (url: string) => {
  debugLogger.webview.info('webview notify changed events', url);
  backgroundApiProxy.serviceAccount.notifyAccountsChanged();
  backgroundApiProxy.serviceNetwork.notifyChainChanged();
};

export const useNotifyChanges = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation();

  const tab = useWebTab();
  useEffect(() => {
    if (!tab) {
      return;
    }
    if (!isFocused) {
      let tabNav = navigation;
      if (tabNav.getState().type !== 'tab') {
        tabNav = navigation.getParent();
      }
      const { routeNames, index: navIndex } = tabNav.getState();
      const isInDiscoverTab = (routeNames[navIndex] as string) === 'discover';
      if (!isInDiscoverTab) {
        return;
      }
    }
    const ref = webviewRefs[tab.id];
    if (!ref) {
      return;
    }
    const { jsBridge } = ref;
    if (jsBridge) {
      // only enable message for current focused webview
      jsBridge.globalOnMessageEnabled = true;
    } else {
      return;
    }
    debugLogger.webview.info('webview isFocused and connectBridge', tab.url);
    // connect background jsBridge
    backgroundApiProxy.connectBridge(jsBridge);

    if (platformEnv.isNative) {
      notifyChanges(tab.url);
    } else {
      const innerRef = ref.innerRef as IElectronWebView;
      // @ts-ignore
      if (innerRef.__domReady) {
        notifyChanges(tab.url);
      } else {
        const onDomReady = () => {
          notifyChanges(tab.url);
        };
        innerRef.addEventListener('dom-ready', onDomReady);

        return () => {
          innerRef.removeEventListener('dom-ready', onDomReady);
        };
      }
    }
  }, [tab, isFocused, navigation]);
};
