import { useCallback, useRef } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useClipboard, useShortcuts } from '@onekeyhq/components';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

export const useDiscoveryShortcuts = () => {
  const { copyText } = useClipboard();
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const isAtDiscoveryTab = useRef(false);
  const isAtBrowserTab = useRef(false);
  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    isAtDiscoveryTab.current = isFocus;
  });
  useListenTabFocusState(
    ETabRoutes.MultiTabBrowser,
    (isFocus, isHideByModal) => {
      isAtBrowserTab.current = !isHideByModal && isFocus;
    },
  );

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
      closeWebTab({ tabId: activeTabId, entry: 'ShortCut' });
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
          } else {
            globalThis.desktopApi.reload();
          }
          break;
        case EShortcutEvents.CloseTab:
          if (isAtBrowserTab.current) {
            handleCloseWebTab();
          } else {
            globalThis.desktopApi.quitApp();
          }
          return;
        case EShortcutEvents.SearchInPage:
          if (isAtBrowserTab.current || isAtDiscoveryTab.current) {
            navigation.pushModal(EModalRoutes.DiscoveryModal, {
              screen: EDiscoveryModalRoutes.SearchModal,
            });
          }
          break;
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
    [activeTabId, copyText, handleCloseWebTab, navigation],
  );

  useShortcuts(undefined, handleShortcuts);
};
