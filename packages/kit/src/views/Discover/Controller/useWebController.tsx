/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  homeResettingFlags,
  homeTab,
  webTabsActions,
} from '../Explorer/Context/contextWebTabs';
import { webviewRefs } from '../explorerUtils';

import { gotoSite } from './gotoSite';
import { getWebTabs, useWebTabs } from './useWebTabs';
import { useWebviewRef } from './useWebviewRef';

import type { IElectronWebView } from '../../../components/WebView/types';
import type { OnWebviewNavigation } from '../explorerUtils';

export const onNavigation: OnWebviewNavigation = ({
  url,
  isNewWindow,
  isInPlace,
  title,
  favicon,
  canGoBack,
  canGoForward,
  loading,
  id,
}) => {
  const now = Date.now();
  const { tab: curTab } = getWebTabs(id);
  if (!curTab) {
    return;
  }
  const curId = curTab.id;
  const isValidNewUrl = typeof url === 'string' && url !== curTab.url;
  if (isValidNewUrl) {
    if (curTab.timestamp && now - curTab.timestamp < 500) {
      // ignore url change if it's too fast to avoid back & forth loop
      return;
    }
    if (
      homeResettingFlags[curId] &&
      url !== homeTab.url &&
      now - homeResettingFlags[curId] < 1000
    ) {
      return;
    }
    gotoSite({ url, title, favicon, isNewWindow, isInPlace, id: curId });
  }
  webTabsActions.setWebTabData({
    id: curId,
    title,
    favicon,
    canGoBack,
    canGoForward,
    loading,
  });
};

export const useWebController = ({
  id,
}:
  | {
      id?: string;
    }
  | undefined = {}) => {
  const { currentTabId, tabs, tab } = useWebTabs(id);
  const curId = id || currentTabId;
  const [innerRef, setInnerRef] = useState(webviewRefs[curId]?.innerRef);

  useEffect(() => {
    if (tab?.refReady) {
      setInnerRef(webviewRefs[curId]?.innerRef);
    }
  }, [curId, tab?.refReady]);

  const { goBack, goForward, stopLoading, reload } = useWebviewRef({
    ref: innerRef as IElectronWebView,
    onNavigation,
    tabId: curId,
  });

  return {
    tabs,
    currentTabId,
    currentTab: tab,
    goBack: () => {
      let canGoBack = tab?.refReady && tab?.canGoBack;
      if (platformEnv.isDesktop) {
        if (innerRef) {
          canGoBack = (innerRef as IElectronWebView).canGoBack();
        }
      }

      stopLoading();
      if (canGoBack) {
        goBack();
      } else {
        webTabsActions.setWebTabData({
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
