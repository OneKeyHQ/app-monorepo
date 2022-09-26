import { useCallback, useEffect, useMemo } from 'react';

import { nanoid } from '@reduxjs/toolkit';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { DialogManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  WebSiteHistory,
  addWebSiteHistory,
  updateFirstRemindDAPP,
  updateHistory,
} from '../../../../store/reducers/discover';
import {
  addWebTab,
  setCurrentWebTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { openUrl } from '../../../../utils/openUrl';
import DappOpenHintDialog from '../DappOpenHintDialog';
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
  const { firstRemindDAPP } = useAppSelector((s) => s.discover);
  const { currentTabId, tabs } = useAppSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  const webviewRef = webviewRefs[curId];
  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs]);
  const gotoHome = useCallback(
    () => dispatch(setCurrentWebTab('home')),
    [dispatch],
  );
  const gotoSite = useCallback(
    ({ url, title, favicon, dAppId }: WebSiteHistory & { dAppId?: string }) => {
      if (url) {
        if (webHandler === 'browser') {
          return openUrl(url);
        }
        dispatch(
          curId === 'home' && webHandler === 'tabbedWebview'
            ? addWebTab({
                id: nanoid(),
                title,
                url,
                favicon,
                isCurrent: true,
              })
            : setWebTabData({ id: curId, url, title, favicon }),
          dAppId
            ? updateHistory(dAppId)
            : addWebSiteHistory({
                webSite: { url, title, favicon },
              }),
        );
      }
    },
    [curId, dispatch],
  );
  const openMatchDApp = useCallback(
    async ({ dapp, webSite }: MatchDAppItemType) => {
      if (webSite) {
        return gotoSite({
          url: webSite.url,
          title: webSite.title,
          favicon: webSite.favicon,
        });
      }

      // 打开的是 Dapp, 处理首次打开 Dapp 提示
      if (dapp && firstRemindDAPP && dapp.url !== tab?.url) {
        let dappOpenConfirm: ((confirm: boolean) => void) | undefined;
        DialogManager.show({
          render: (
            <DappOpenHintDialog
              onVisibilityChange={() => {
                dappOpenConfirm = undefined;
              }}
              onConfirm={() => {
                dappOpenConfirm?.(true);
              }}
            />
          ),
        });

        const isConfirm = await new Promise<boolean>((resolve) => {
          dappOpenConfirm = resolve;
        });

        if (!isConfirm) {
          return;
        }

        dispatch(updateFirstRemindDAPP(false));
        return gotoSite({
          url: dapp.url,
          title: dapp.name,
          favicon: dapp.favicon,
          dAppId: dapp.id,
        });
      }
    },
    [firstRemindDAPP, dispatch, gotoSite, tab?.url],
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
    // TODO 避免手动触发
    if (url && url !== tab?.url) {
      gotoSite({
        url,
        title,
        favicon,
      });
    }
  }, [dispatch, favicon, gotoSite, id, tab?.url, title, url]);

  return {
    tabs,
    currentTabId,
    currentTab: tab,
    gotoHome,
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
