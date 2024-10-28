import { useCallback, useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShortcutsOnRouteFocused } from '@onekeyhq/kit/src/hooks/useShortcutsOnRouteFocused';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import DesktopBrowserInfoBar from '../../components/DesktopBrowser/DesktopBrowserInfoBar';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { getWebviewWrapperRef, webviewRefs } from '../../utils/explorerUtils';

import { withBrowserProvider } from './WithBrowserProvider';

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

  const handleBookmark = useCallback(
    (isBookmark: boolean) => {
      onPressBookmark(isBookmark);
    },
    [onPressBookmark],
  );

  const handlePin = useCallback(
    (pinned: boolean) => {
      void setPinnedTab({ id, pinned });
    },
    [id, setPinnedTab],
  );

  const handleSearch = useCallback(
    (url: string) => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
        params: {
          useCurrentWindow: true,
          tabId: id,
          url,
        },
      });
    },
    [id, navigation],
  );

  const onShortcutsBookmark = useCallback(() => {
    if (isActive) {
      const isBookmark = tab?.isBookmark ?? false;
      handleBookmark(!isBookmark);
    }
  }, [handleBookmark, isActive, tab?.isBookmark]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.AddOrRemoveBookmark,
    onShortcutsBookmark,
  );

  const onShortcutsPin = useCallback(() => {
    if (isActive) {
      const isPinned = tab?.isPinned ?? false;
      handlePin(!isPinned);
    }
  }, [handlePin, isActive, tab?.isPinned]);

  useShortcutsOnRouteFocused(EShortcutEvents.PinOrUnpinTab, onShortcutsPin);

  const onShortcutsChangeUrl = useCallback(() => {
    if (isActive) {
      handleSearch(tab.url);
    }
  }, [handleSearch, isActive, tab.url]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.ChangeCurrentTabUrl,
    onShortcutsChangeUrl,
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
        onPinnedPress={handlePin}
        onSearch={handleSearch}
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
