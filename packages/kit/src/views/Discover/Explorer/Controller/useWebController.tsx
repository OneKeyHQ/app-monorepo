import { useCallback, useEffect, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { DialogManager } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { appSelector } from '../../../../store';
import { updateFirstRemindDAPP } from '../../../../store/reducers/discover';
import {
  homeResettingFlags,
  homeTab,
  setIncomingUrl,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import DappOpenHintDialog from '../DappOpenHintDialog';
import {
  MatchDAppItemType,
  OnWebviewNavigation,
  webviewRefs,
} from '../explorerUtils';

import { useGotoSite } from './useGotoSite';
import { useWebviewRef } from './useWebviewRef';

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
  const curId = id || currentTabId;
  const [innerRef, setInnerRef] = useState(webviewRefs[curId]?.innerRef);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs])!;

  useEffect(() => {
    if (tab.refReady) {
      setInnerRef(webviewRefs[curId]?.innerRef);
    }
  }, [curId, tab.refReady]);

  const clearIncomingUrl = useCallback(
    () => dispatch(setIncomingUrl('')),
    [dispatch],
  );
  const gotoSite = useGotoSite({
    tab,
  });
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
      const now = Date.now();
      const isValidNewUrl = typeof url === 'string' && url !== tab.url;

      if (isValidNewUrl) {
        if (tab.timestamp && now - tab.timestamp < 500) {
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
    [curId, dispatch, gotoSite, tab],
  );

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
    gotoSite,
    openMatchDApp,
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
    reload,
  };
};
