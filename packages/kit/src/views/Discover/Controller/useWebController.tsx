/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  homeTab,
  useWebTabsActions,
  useWebTabsInfo,
} from '../Explorer/Context/contextWebTabs';
import { webviewRefs } from '../explorerUtils';

import { useWebviewRef } from './useWebviewRef';

import type { IElectronWebView } from '../../../components/WebView/types';
import type WebView from 'react-native-webview';

export const useWebController = ({
  id,
}:
  | {
      id?: string;
    }
  | undefined = {}) => {
  const actions = useWebTabsActions();
  const { currentTabId, tabs, tab } = useWebTabsInfo(id);
  const curId = id || currentTabId;
  const [innerRef, setInnerRef] = useState(webviewRefs[curId]?.innerRef);

  useEffect(() => {
    if (tab?.refReady) {
      setInnerRef(webviewRefs[curId]?.innerRef);
    }
  }, [curId, tab?.refReady]);

  const { goBack, goForward, stopLoading, reload } = useWebviewRef({
    ref: innerRef as IElectronWebView,
    onNavigation: actions.handleWebviewNavigation,
    tabId: curId,
  });

  return {
    tabs,
    currentTabId,
    currentTab: tab,
    goBack: () => {
      let canGoBack = tab?.refReady && tab?.canGoBack;
      if (platformEnv.isDesktop && innerRef) {
        canGoBack = (innerRef as IElectronWebView).canGoBack();
      }

      stopLoading();
      console.log('=>>>canGoBack: ', canGoBack);
      if (canGoBack) {
        goBack();
      } else {
        if (platformEnv.isNative && innerRef) {
          (innerRef as WebView)?.loadUrl(homeTab.url);
        }
        actions.setWebTabData({
          ...homeTab,
          id: curId,
        });
      }
    },
    goForward,
    stopLoading,
    reload,
  };
};
