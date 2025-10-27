import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useClipboard, useShortcuts } from '@onekeyhq/components';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useShortcutsRouteStatus } from '../../../hooks/useListenTabFocusState';
import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

export const useDiscoveryShortcuts = () => {
  const { copyText } = useClipboard();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const { isAtBrowserTab, shouldReloadAppByCmdR } = useShortcutsRouteStatus();

  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;
  const { tabs } = useWebTabs();

  const handleCloseWebTab = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    const tabIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (tabs[tabIndex].isPinned) {
      navigation.switchTab(ETabRoutes.Discovery);
    } else {
      closeWebTab({
        tabId: activeTabId,
        entry: 'ShortCut',
        navigation,
      });
    }
  }, [activeTabId, tabs, closeWebTab, navigation]);

  const handleShortcuts = useCallback(
    (data: EShortcutEvents) => {
      // only handle shortcuts when at browser tab
      switch (data) {
        case EShortcutEvents.CopyAddressOrUrl:
          if (isAtBrowserTab.current) {
            try {
              const url = (
                webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
              )?.getURL();
              if (url) {
                copyText(url);
              }
            } catch {
              // empty
            }
          }
          break;
        case EShortcutEvents.GoForwardHistory:
          if (isAtBrowserTab.current) {
            try {
              (
                webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
              )?.goForward();
            } catch {
              // empty
            }
          }
          break;
        case EShortcutEvents.GoBackHistory:
          if (isAtBrowserTab.current) {
            try {
              (
                webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
              )?.goBack();
            } catch {
              // empty
            }
          }
          break;
        case EShortcutEvents.Refresh:
          if (isAtBrowserTab.current) {
            try {
              (
                webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
              )?.reload();
            } catch {
              // empty
            }
          } else if (shouldReloadAppByCmdR.current) {
            void globalThis.desktopApiProxy?.system?.reload?.();
          }
          break;
        case EShortcutEvents.CloseTab:
          if (isAtBrowserTab.current) {
            handleCloseWebTab();
          } else {
            void globalThis.desktopApiProxy?.system?.quitApp?.();
          }
          return;
        case EShortcutEvents.ViewHistory:
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.HistoryListModal,
          });
          break;
        case EShortcutEvents.ViewBookmark:
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.BookmarkListModal,
          });
          break;
        case EShortcutEvents.UniversalSearch:
          navigation.pushModal(EModalRoutes.UniversalSearchModal, {
            screen: EUniversalSearchPages.UniversalSearch,
          });
          break;
        default:
          break;
      }
    },
    [
      activeTabId,
      copyText,
      handleCloseWebTab,
      isAtBrowserTab,
      navigation,
      shouldReloadAppByCmdR,
    ],
  );

  useShortcuts(undefined, handleShortcuts);
};
