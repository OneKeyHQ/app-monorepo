import { useCallback, useEffect } from 'react';

import { nanoid } from '@reduxjs/toolkit';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../../store';
import {
  WebSiteHistory,
  addWebSiteHistory,
  updateHistory,
} from '../../../../store/reducers/discover';
import { addWebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import { MatchDAppItemType, webHandler } from '../explorerUtils';

import { useWebviewRef } from './useWebviewRef';
import { webviewRefs } from './webviewRefs';

export const useWebController = ({
  id,
  navigationStateChangeEvent,
}:
  | {
      id?: string;
      navigationStateChangeEvent?: WebViewNavigation;
    }
  | undefined = {}) => {
  const { dispatch } = backgroundApiProxy;
  const { currentTabId, tabs } = appSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  const webviewRef = webviewRefs[curId];
  const tab = tabs.find((t) => t.id === curId);
  const gotoSite = useCallback(
    ({ url, title, favicon, dAppId }: WebSiteHistory & { dAppId?: string }) => {
      if (url) {
        dispatch(
          id === 'home' && webHandler === 'tabbedWebview'
            ? addWebTab({
                id: nanoid(),
                title,
                url,
                favicon,
                isCurrent: true,
              })
            : setWebTabData({ id, url, title, favicon }),
          dAppId
            ? updateHistory(dAppId)
            : addWebSiteHistory({
                webSite: { url, title, favicon },
              }),
        );
      }
    },
    [id, dispatch],
  );
  const openMatchDApp = useCallback(
    ({ dapp, webSite }: MatchDAppItemType) => {
      const site = webSite || dapp;
      if (site) {
        return gotoSite({
          url: site.url,
          title: dapp?.name || webSite?.title,
          favicon: site.favicon,
          dAppId: dapp?.id,
        });
      }
    },
    [gotoSite],
  );
  const {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    stopLoading,
    loading,
    url,
    title,
    favicon,
    // eslint-disable-next-line @typescript-eslint/no-shadow
    // @ts-expect-error
  } = useWebviewRef(webviewRef?.innerRef, navigationStateChangeEvent);

  useEffect(() => {
    if (url && url !== tab?.url) {
      gotoSite({
        url,
        title,
        favicon,
      });
    }
  }, [dispatch, favicon, gotoSite, id, tab?.url, title, url]);

  return {
    gotoSite,
    openMatchDApp,
    url: url || tab?.url,
    title: title || tab?.title,
    favicon: favicon || tab?.favicon,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    stopLoading,
    loading,
  };
};
