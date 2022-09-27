import { useCallback, useMemo } from 'react';

import { nanoid } from '@reduxjs/toolkit';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { DialogManager } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  setIncomingUrl,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { openUrl } from '../../../../utils/openUrl';
import DappOpenHintDialog from '../DappOpenHintDialog';
import { MatchDAppItemType, webHandler, webviewRefs } from '../explorerUtils';

import { useWebviewRef } from './useWebviewRef';

let lastNewUrlTimestamp = Date.now();
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
  const { currentTabId, tabs, incomingUrl } = useAppSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  const innerRef = webviewRefs[curId]?.innerRef;

  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs]);
  const gotoHome = useCallback(
    () => dispatch(setCurrentWebTab('home')),
    [dispatch],
  );
  const clearIncomingUrl = useCallback(
    () => dispatch(setIncomingUrl('')),
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
        if (
          !isNewTab &&
          !isInPlace &&
          tab?.url !== '' &&
          platformEnv.isDesktop
        ) {
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          innerRef?.loadURL(url);
        }
        return true;
      }
      return false;
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

      if (dapp && dapp.url !== tab?.url) {
        if (firstRemindDAPP) {
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
            return false;
          }

          dispatch(updateFirstRemindDAPP(false));
        }

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
      let isValidNewUrl = typeof url === 'string' && url !== '';
      // tab url changes *AFTER* `gotoSite` on desktop
      // but *BEFORE* `gotoSite` on native
      // so new target url should not be the same on desktop
      // but can be the same on native
      if (isValidNewUrl && platformEnv.isDesktop) {
        isValidNewUrl = url !== tab?.url;
      }
      if (isValidNewUrl) {
        if (Date.now() - lastNewUrlTimestamp < 500) {
          // ignore url change if it's too fast to avoid back & forth loop
          return;
        }
        lastNewUrlTimestamp = Date.now();
        gotoSite({ url, title, favicon, isNewWindow, isInPlace });
      } else if (title) {
        dispatch(setWebTabData({ id: curId, title }));
      } else if (favicon) {
        dispatch(setWebTabData({ id: curId, favicon }));
      }
    },
    [curId, dispatch, gotoSite, tab?.url],
  );
  const { canGoBack, canGoForward, goBack, goForward, stopLoading, loading } =
    useWebviewRef({
      // @ts-expect-error
      ref: innerRef,
      onNavigation,
      navigationStateChangeEvent,
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
    incomingUrl,
    clearIncomingUrl,
    loading,
  };
};
