import { useCallback, useMemo } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
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
import {
  MatchDAppItemType,
  searchContentMaps,
  webHandler,
  webviewRefs,
} from '../explorerUtils';

import { useWebviewRef } from './useWebviewRef';

let lasNewUrlTimestamp = Date.now();
export const useWebController = ({
  id,
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
  const innerRef = webviewRefs[curId]?.innerRef;
  const searchContent = searchContentMaps[curId];
  const setSearchContent = useCallback(
    (content: string) => {
      searchContentMaps[curId] = content;
    },
    [curId],
  );

  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs]);
  const gotoHome = useCallback(
    () => dispatch(setCurrentWebTab('home')),
    [dispatch],
  );
  const gotoSite = useCallback(
    ({
      url,
      title,
      favicon,
      dAppId,
      isNewWindow,
      isInPlace,
    }: WebSiteHistory & {
      dAppId?: string;
      isNewWindow?: boolean;
      isInPlace?: boolean;
    }) => {
      if (url) {
        if (webHandler === 'browser') {
          return openUrl(url);
        }
        const isNewTab =
          (isNewWindow || curId === 'home') && webHandler === 'tabbedWebview';

        dispatch(
          isNewTab
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
        if (!isNewTab && !isInPlace && tab?.url !== '') {
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          innerRef?.loadURL(url);
        }
      }
    },
    [curId, dispatch, innerRef, tab?.url],
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
  const onNavigation = useCallback(
    ({ url, title, favicon, isNewWindow, isInPlace }) => {
      if (url && url !== tab?.url) {
        if (Date.now() - lasNewUrlTimestamp < 500) {
          return;
        }
        lasNewUrlTimestamp = Date.now();
        gotoSite({ url, title, favicon, isNewWindow, isInPlace });
      } else if (title) {
        dispatch(setWebTabData({ id: curId, title }));
      } else if (favicon) {
        dispatch(setWebTabData({ id: curId, favicon }));
      }
    },
    [curId, dispatch, gotoSite, tab?.url],
  );
  const { canGoBack, canGoForward, goBack, goForward, stopLoading } =
    useWebviewRef({
      // @ts-expect-error
      ref: innerRef,
      onNavigation,
    });

  return {
    tabs,
    currentTabId,
    currentTab: tab,
    gotoHome,
    gotoSite,
    openMatchDApp,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    stopLoading,
    searchContent,
    setSearchContent,
  };
};
