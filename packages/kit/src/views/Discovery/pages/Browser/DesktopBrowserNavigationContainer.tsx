import { memo, useCallback } from 'react';

import { Freeze } from 'react-freeze';

import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShortcutsOnRouteFocused } from '@onekeyhq/kit/src/hooks/useShortcutsOnRouteFocused';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import DesktopBrowserInfoBar from '../../components/DesktopBrowser/DesktopBrowserInfoBar';
import { usePageTranslation } from '../../hooks/usePageTranslation';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabIds,
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
  const {
    isTranslated,
    handleTranslate,
    handleRetranslate,
    handleTranslateTestAIError,
  } = usePageTranslation(id);
  const isActive = activeTabId === id;
  const { setPinnedTab, setWebTabData } = useBrowserTabActions().current;
  const {
    addOrUpdateBrowserBookmark: addBrowserBookmark,
    removeBrowserBookmark,
  } = useBrowserBookmarkAction().current;
  // Resolve the live wrapper on demand instead of caching the element in
  // component state. `refReady` is set to true exactly once per tab and is
  // never reset, so the effect that used to refresh that state never fired
  // again after an LRU eviction replaced the <webview>. Every nav bar then
  // kept pointing at a destroyed element — and through the `__reactFiber$`
  // property React attaches to it, pinned the whole previous WebContent
  // subtree in the heap.
  const getInnerRef = useCallback(
    () => webviewRefs[id]?.innerRef as IElectronWebView | undefined,
    [id],
  );

  const goBack = useCallback(() => {
    const innerRef = getInnerRef();
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
  }, [getInnerRef, tab?.canGoBack, tab?.refReady]);
  const goForward = useCallback(() => {
    try {
      getInnerRef()?.goForward();
    } catch {
      /* empty */
    }
  }, [getInnerRef]);
  const stopLoading = useCallback(() => {
    try {
      getInnerRef()?.stop();
    } catch {
      /* empty */
    }
  }, [getInnerRef]);
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
      void setWebTabData({
        id,
        isBookmark,
      });
    },
    [tab, setWebTabData, id, addBrowserBookmark, removeBrowserBookmark],
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
          useCurrentWindow: !tab?.isPinned,
          tabId: id,
          url,
        },
      });
    },
    [id, navigation, tab?.isPinned],
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
    if (tab?.url && isActive && !platformEnv.isDesktop) {
      handleSearch(tab.url);
    }
  }, [handleSearch, isActive, tab?.url]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.ChangeCurrentTabUrl,
    onShortcutsChangeUrl,
  );

  // Key on the tab id only. Embedding the url meant every in-page navigation
  // of any tab discarded that tab's whole info-bar subtree and mounted a fresh
  // one — a steady stream of thrown-away fiber trees on a component that is
  // mounted once per open tab. The bar already re-renders from `tab` props
  // when the url changes.
  if (tab) {
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
          isTranslated={isTranslated}
          onTranslate={handleTranslate}
          onRetranslate={handleRetranslate}
          onTestAITranslateError={handleTranslateTestAIError}
        />
      </Freeze>
    );
  }
  return null;
}

// Memo boundary per tab. The container re-renders whenever the tab list atom
// is written — which now happens on any tab field change, not just an id-list
// change — and without this every open tab's whole info bar (translation hooks,
// shortcut registrations, Tamagui subtree) re-rendered with it.
const DesktopBrowserNavigationBarMemo = memo(DesktopBrowserNavigationBar);

function DesktopBrowserNavigationBarContainer() {
  // ids-only subscription: the container maps ids to memoized per-tab bars and
  // never reads tab fields itself, so field-only writes must not re-run it.
  const { ids } = useWebTabIds();
  const { activeTabId } = useActiveTabId();
  return ids.map((id) => (
    <DesktopBrowserNavigationBarMemo
      key={`DesktopBrowserNavigationContainer-${id}`}
      id={id}
      activeTabId={activeTabId}
    />
  ));
}

export default withBrowserProvider(DesktopBrowserNavigationBarContainer);
