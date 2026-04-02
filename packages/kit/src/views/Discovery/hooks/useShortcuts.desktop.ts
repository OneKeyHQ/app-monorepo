import { useCallback } from 'react';

import { useClipboard, useShortcuts } from '@onekeyhq/components';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useShortcutsRouteStatus } from '../../../hooks/useListenTabFocusState';
import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

function getActiveWebview(
  tabId: string | null | undefined,
): IElectronWebView | undefined {
  if (!tabId) return undefined;
  try {
    return webviewRefs[tabId]?.innerRef as IElectronWebView | undefined;
  } catch {
    return undefined;
  }
}

export const useDiscoveryShortcuts = () => {
  const { copyText } = useClipboard();
  const navigation = useAppNavigation();

  const { isAtBrowserTab } = useShortcutsRouteStatus();

  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;
  const { tabs } = useWebTabs();

  const handleCloseWebTab = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    const tabIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (tabIndex === -1) {
      return;
    }
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
      switch (data) {
        // webview-specific shortcuts — only when a browser tab is focused
        case EShortcutEvents.CopyAddressOrUrl:
        case EShortcutEvents.GoForwardHistory:
        case EShortcutEvents.GoBackHistory:
        case EShortcutEvents.Refresh:
        case EShortcutEvents.CloseTab: {
          if (!isAtBrowserTab.current) {
            return;
          }
          const webview = getActiveWebview(activeTabId);
          try {
            switch (data) {
              case EShortcutEvents.CopyAddressOrUrl: {
                const url = webview?.getURL();
                if (url) {
                  copyText(url);
                }
                break;
              }
              case EShortcutEvents.GoForwardHistory:
                webview?.goForward();
                break;
              case EShortcutEvents.GoBackHistory:
                webview?.goBack();
                break;
              case EShortcutEvents.Refresh:
                webview?.reload();
                break;
              case EShortcutEvents.CloseTab:
                handleCloseWebTab();
                break;
              default:
                break;
            }
          } catch {
            // webview methods may throw if webContents is destroyed
          }
          break;
        }
        // navigation shortcuts — available whenever Discovery is mounted
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
        default:
          break;
      }
    },
    [activeTabId, copyText, handleCloseWebTab, isAtBrowserTab, navigation],
  );

  useShortcuts(undefined, handleShortcuts);
};
