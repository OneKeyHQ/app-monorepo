import { useCallback, useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import DesktopBrowserInfoBar from '../../components/DesktopBrowser/DesktopBrowserInfoBar';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { getWebviewWrapperRef, webviewRefs } from '../../utils/explorerUtils';

import { withBrowserProvider } from './WithBrowserProvider';

import type { IElectronWebView } from '../../components/WebView/types';

function DesktopBrowserNavigationBar({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const navigation = useAppNavigation();
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const { setPinnedTab, setWebTabData } = useBrowserTabActions().current;
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const [innerRef, setInnerRef] = useState<IElectronWebView>(
    webviewRefs[id]?.innerRef as IElectronWebView,
  );

  useEffect(() => {
    if (tab?.refReady) {
      setInnerRef(webviewRefs[id]?.innerRef as IElectronWebView);
    }
  }, [id, tab?.refReady]);

  const goBack = useCallback(() => {
    let canGoBack = tab?.refReady && tab?.canGoBack;
    if (innerRef) {
      canGoBack = innerRef.canGoBack();
    }
    innerRef?.stop();
    if (canGoBack) {
      try {
        innerRef?.goBack();
      } catch {
        /* empty */
      }
    }
  }, [innerRef, tab?.canGoBack, tab?.refReady]);
  const goForward = useCallback(() => {
    try {
      innerRef?.goForward();
    } catch {
      /* empty */
    }
  }, [innerRef]);
  const stopLoading = useCallback(() => {
    try {
      innerRef?.stop();
    } catch {
      /* empty */
    }
  }, [innerRef]);
  const reload = useCallback(() => {
    try {
      const wrapperRef = getWebviewWrapperRef(id);
      // cross-platform reload()
      wrapperRef?.reload();
    } catch {
      /* empty */
    }
  }, [id]);

  const onPressBookmark = useCallback(
    (isBookmark: boolean) => {
      if (isBookmark) {
        void addBrowserBookmark({ url: tab?.url, title: tab?.title ?? '' });
      } else {
        void removeBrowserBookmark(tab?.url);
      }
      void setWebTabData({
        id,
        isBookmark,
      });
    },
    [
      addBrowserBookmark,
      removeBrowserBookmark,
      setWebTabData,
      tab?.title,
      tab?.url,
      id,
    ],
  );

  return (
    <Freeze key={`${id}-navigationBar`} freeze={!isActive}>
      <DesktopBrowserInfoBar
        {...tab}
        goBack={goBack}
        goForward={goForward}
        stopLoading={stopLoading}
        reload={reload}
        isBookmark={tab?.isBookmark ?? false}
        onBookmarkPress={onPressBookmark}
        isPinned={tab?.isPinned ?? false}
        onPinnedPress={(pinned) => {
          void setPinnedTab({ id, pinned });
        }}
        onSearch={(url: string) => {
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.SearchModal,
            params: {
              useCurrentWindow: true,
              tabId: id,
              url,
            },
          });
        }}
      />
    </Freeze>
  );
}

function DesktopBrowserNavigationBarContainer() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  return tabs.map((t) => (
    <DesktopBrowserNavigationBar
      key={`DesktopBrowserNavigationContainer-${t.id}`}
      id={t.id}
      activeTabId={activeTabId}
    />
  ));
}

export default withBrowserProvider(DesktopBrowserNavigationBarContainer);
