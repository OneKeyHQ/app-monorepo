import { useCallback, useMemo, useRef } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { DialogManager } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { appSelector } from '../../../../store';
import { updateFirstRemindDAPP } from '../../../../store/reducers/discover';
import {
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
  const getInnerRef = useCallback(() => webviewRefs[curId]?.innerRef, [curId]);
  const lastNewUrlTimestamp = useRef(Date.now());
  const tab = useMemo(() => tabs.find((t) => t.id === curId), [curId, tabs]);

  const clearIncomingUrl = useCallback(
    () => dispatch(setIncomingUrl('')),
    [dispatch],
  );
  const gotoSite = useGotoSite({
    tab,
    getInnerRef,
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
      let isValidNewUrl = typeof url === 'string' && url !== '';
      // tab url changes *AFTER* `gotoSite` on desktop
      // but *BEFORE* `gotoSite` on native
      // so new target url should not be the same on desktop
      // but can be the same on native
      if (isValidNewUrl && platformEnv.isDesktop) {
        isValidNewUrl = url !== tab?.url;
      }
      if (isValidNewUrl) {
        if (Date.now() - lastNewUrlTimestamp.current < 500) {
          // ignore url change if it's too fast to avoid back & forth loop
          return;
        }
        lastNewUrlTimestamp.current = Date.now();
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
