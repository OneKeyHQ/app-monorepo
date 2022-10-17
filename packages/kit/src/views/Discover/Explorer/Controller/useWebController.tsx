import { useCallback, useMemo } from 'react';

import { nanoid } from '@reduxjs/toolkit';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { DialogManager } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { appSelector } from '../../../../store';
import {
  addWebSiteHistory,
  setDappHistory,
  updateFirstRemindDAPP,
  updateHistory,
} from '../../../../store/reducers/discover';
import {
  addWebTab,
  closeWebTab,
  homeTab,
  setIncomingUrl,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { openUrl } from '../../../../utils/openUrl';
import { WebSiteHistory } from '../../type';
import DappOpenHintDialog from '../DappOpenHintDialog';
import {
  MatchDAppItemType,
  OnWebviewNavigation,
  validateUrl,
  webHandler,
  webviewRefs,
} from '../explorerUtils';

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
  const { currentTabId, tabs, incomingUrl } = useAppSelector((s) => s.webTabs);
  const dappFavorites = useAppSelector((s) => s.discover.dappFavorites);
  const curId = id || currentTabId;
  const getInnerRef = useCallback(() => webviewRefs[curId]?.innerRef, [curId]);

  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs]);
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
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }
        if (webHandler === 'browser') {
          return openUrl(validatedUrl);
        }
        const isNewTab =
          (isNewWindow || curId === 'home') && webHandler === 'tabbedWebview';

        const tabId = isNewTab ? nanoid() : curId;
        if (dAppId) {
          dispatch(setDappHistory(dAppId));
        }
        const isBookmarked = dappFavorites?.includes(url);

        dispatch(
          isNewTab
            ? addWebTab({
                id: tabId,
                title,
                url: validatedUrl,
                favicon,
                isCurrent: true,
                isBookmarked,
              })
            : setWebTabData({
                id: tabId,
                url: validatedUrl,
                title,
                favicon,
                isBookmarked,
              }),
          dAppId
            ? updateHistory(dAppId)
            : addWebSiteHistory({
                webSite: { url: validatedUrl, title, favicon },
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
          getInnerRef()?.loadURL(validatedUrl);
        }

        // close deep link tab after 1s
        if (!validatedUrl.startsWith('http')) {
          setTimeout(() => {
            dispatch(closeWebTab(tabId));
          }, 1000);
        }
        return true;
      }
      return false;
    },
    [curId, dispatch, getInnerRef, tab?.url, dappFavorites],
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
        const { firstRemindDAPP } = appSelector((s) => s.discover);
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
          dAppId: dapp._id,
        });
      }
    },
    [dispatch, gotoSite, tab?.url],
  );
  const onNavigation: OnWebviewNavigation = useCallback(
    ({
      url,
      isNewWindow,
      isInPlace,
      title,
      favicon,
      canGoBack,
      canGoForward,
      loading,
    }) => {
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
      }

      dispatch(
        setWebTabData({
          id: curId,
          title,
          favicon,
          canGoBack,
          canGoForward,
          loading,
        }),
      );
    },
    [curId, dispatch, gotoSite, tab?.url],
  );
  const { goBack, goForward, stopLoading } = useWebviewRef({
    // @ts-expect-error
    ref: getInnerRef(),
    onNavigation,
    navigationStateChangeEvent,
  });

  return {
    tabs,
    currentTabId,
    currentTab: tab,
    gotoSite,
    openMatchDApp,
    goBack: () => {
      if (tab?.canGoBack) {
        goBack();
      } else {
        dispatch(
          setWebTabData({
            ...homeTab,
            id: curId,
          }),
        );
      }
    },
    goForward,
    stopLoading,
    incomingUrl,
    clearIncomingUrl,
  };
};
