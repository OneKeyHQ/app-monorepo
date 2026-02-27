import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Toast, useClipboard, useSafeAreaInsets } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import {
  useDisplayHomePageFlag,
  useWebTabDataById,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { showTabBar } from '../../utils/tabBarUtils';

import type { ESiteMode } from '../../types';
import type WebView from 'react-native-webview';

export interface IMobileBrowserBottomBarProps extends IStackProps {
  id: string;
  onGoBackHomePage?: () => void;
}

export function useMobileBrowserBottomBarData({
  id,
  onGoBackHomePage,
}: {
  id: string;
  onGoBackHomePage?: () => void;
}) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  const { tab } = useWebTabDataById(id);

  const origin = tab?.url ? new URL(tab.url).origin : null;
  const { result: hasConnectedAccount, run: refreshConnectState } =
    usePromiseResult(async () => {
      try {
        if (!origin) {
          return false;
        }
        const connectedAccount =
          await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
            origin,
          );
        return (connectedAccount ?? []).length > 0;
      } catch {
        return false;
      }
    }, [origin]);

  const { displayHomePage } = useDisplayHomePageFlag();
  const { setPinnedTab, setCurrentWebTab, closeWebTab, setSiteMode } =
    useBrowserTabActions().current;

  const {
    addOrUpdateBrowserBookmark: addBrowserBookmark,
    removeBrowserBookmark,
  } = useBrowserBookmarkAction().current;
  const { handleShareUrl } = useBrowserOptionsAction();

  const handleBookmarkPress = useCallback(
    (isBookmark: boolean) => {
      if (tab) {
        if (isBookmark) {
          void addBrowserBookmark({
            url: tab?.url,
            title: tab?.title ?? '',
            logo: undefined,
            sortIndex: undefined,
          });
        } else {
          void removeBrowserBookmark(tab?.url);
        }
      }
      Toast.success({
        title: isBookmark
          ? intl.formatMessage({
              id: ETranslations.explore_toast_bookmark_added,
            })
          : intl.formatMessage({
              id: ETranslations.explore_toast_bookmark_removed,
            }),
      });
    },
    [tab, intl, addBrowserBookmark, removeBrowserBookmark],
  );

  const handlePinTab = useCallback(
    (pinned: boolean) => {
      setPinnedTab({ id, pinned });
      Toast.success({
        title: pinned
          ? intl.formatMessage({ id: ETranslations.explore_toast_pinned })
          : intl.formatMessage({ id: ETranslations.explore_toast_unpinned }),
      });
    },
    [setPinnedTab, id, intl],
  );

  const handleCloseTab = useCallback(async () => {
    // a workaround to fix this issue
    //  that remove page includes Popover from screen before closing popover
    setTimeout(() => {
      closeWebTab({ tabId: id, entry: 'Menu' });
      setCurrentWebTab(null);
    });

    showTabBar();
  }, [closeWebTab, setCurrentWebTab, id]);

  const onShare = useCallback(() => {
    handleShareUrl(tab?.displayUrl ?? tab?.url ?? '');
  }, [tab?.displayUrl, tab?.url, handleShareUrl]);

  const { copyText } = useClipboard();
  const onCopyUrl = useCallback(() => {
    const urlToCopy = tab?.displayUrl ?? tab?.url;
    if (urlToCopy) {
      copyText(urlToCopy);
    }
  }, [tab?.displayUrl, tab?.url, copyText]);

  useEffect(() => {
    const fn = () => {
      setTimeout(() => {
        void refreshConnectState();
      }, 200);
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [refreshConnectState]);

  const handleDisconnect = useCallback(async () => {
    if (!origin) return;
    await backgroundApiProxy.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
      entry: 'Browser',
    });
    void refreshConnectState();
  }, [origin, refreshConnectState]);

  const handleRefresh = useCallback(() => {
    webviewRefs[id]?.reload();
  }, [id]);

  const handleRequestSiteMode = useCallback(
    async (siteMode: ESiteMode) => {
      setSiteMode({ id, siteMode });
      await timerUtils.wait(150);
      handleRefresh();
    },
    [handleRefresh, id, setSiteMode],
  );

  const handleGoBack = useCallback(() => {
    (webviewRefs[id]?.innerRef as WebView)?.goBack();
  }, [id]);

  const handleGoForward = useCallback(() => {
    (webviewRefs[id]?.innerRef as WebView)?.goForward();
  }, [id]);

  const handleBrowserOpen = useCallback(() => {
    const urlToOpen = tab?.displayUrl ?? tab?.url;
    if (urlToOpen) {
      openUrlExternal(urlToOpen);
    }
  }, [tab?.displayUrl, tab?.url]);

  const disabledGoBack = displayHomePage || !tab?.canGoBack;
  const disabledGoForward = displayHomePage ? true : !tab?.canGoForward;

  return {
    intl,
    bottom,
    tab,
    hasConnectedAccount,
    displayHomePage,
    handleBookmarkPress,
    handlePinTab,
    handleCloseTab,
    onShare,
    onCopyUrl,
    handleDisconnect,
    handleRefresh,
    handleRequestSiteMode,
    handleGoBack,
    handleGoForward,
    handleBrowserOpen,
    disabledGoBack,
    disabledGoForward,
    onGoBackHomePage,
  };
}
