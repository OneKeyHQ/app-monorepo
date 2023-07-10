import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  homeResettingFlags,
  homeTab,
  webTabsActions,
} from '../../../../store/observable/webTabs';
import { webviewRefs } from '../explorerUtils';

import { gotoSite } from './gotoSite';
import { getWebTabs, useWebTabs } from './useWebTabs';
import { useWebviewRef } from './useWebviewRef';

import type { OnWebviewNavigation } from '../explorerUtils';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

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
  navigationStateChangeEvent,
}:
  | {
      id?: string;
      navigationStateChangeEvent?: WebViewNavigation;
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
    // @ts-expect-error
    ref: innerRef,
    onNavigation,
    navigationStateChangeEvent,
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
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          canGoBack = innerRef.canGoBack();
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
