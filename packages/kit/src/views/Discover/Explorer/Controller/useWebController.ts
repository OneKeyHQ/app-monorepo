import { createRef, useCallback, useContext, useEffect } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { nanoid } from '@reduxjs/toolkit';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../../store';
import {
  WebSiteHistory,
  addWebSiteHistory,
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
  console.log({ curId, webviewRef });
  const tab = tabs.find((t) => t.id === curId);
  const gotoSite = useCallback(
    ({ url, title, favicon }: WebSiteHistory) => {
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
          addWebSiteHistory({
            keyUrl: undefined,
            webSite: { url, title, favicon },
          }),
        );
      }
    },
    [id, dispatch],
  );
  const openMatchDApp = useCallback(
    ({ dapp, webSite }: MatchDAppItemType) => {
      const site = dapp || webSite;
      if (site) {
        gotoSite({
          url: site.url,
          title: dapp?.name || site.url,
          favicon: site.favicon,
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
  } = useWebviewRef(webviewRef, navigationStateChangeEvent);

  useEffect(() => {
    console.log({ url });
    if (url !== tab.url) {
      dispatch(
        setWebTabData({ id, url, title, favicon }),
        addWebSiteHistory({
          keyUrl: undefined,
          webSite: { url, title, favicon },
        }),
      );
    }
  }, [dispatch, favicon, id, tab.url, title, url]);

  return {
    gotoSite,
    openMatchDApp,
    url,
    title,
    favicon,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    stopLoading,
    loading,
  };
};
