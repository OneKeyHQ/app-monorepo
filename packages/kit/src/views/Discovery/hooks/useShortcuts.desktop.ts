import { useCallback, useEffect, useRef } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useShortcuts } from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
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
      if (isAtBrowserTab.current) {
        if (data === EShortcutEvents.GoForwardHistory) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.goForward();
          } catch {
            // empty
          }
        }
        if (data === EShortcutEvents.GoBackHistory) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.goBack();
          } catch {
            // empty
          }
        }
        if (data === EShortcutEvents.Refresh) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.reload();
          } catch {
            // empty
          }
          return;
        }
        if (data === EShortcutEvents.CloseTab) {
          handleCloseWebTab();
          return;
        }
      }
      if (isAtBrowserTab.current || isAtDiscoveryTab.current) {
        if (data === EShortcutEvents.SearchInPage) {
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.SearchModal,
          });
        }
      }

      if (isAtBrowserTab.current) {
        return;
      }

      if (data === EShortcutEvents.CloseTab) {
        window.desktopApi.quitApp();
      } else if (data === EShortcutEvents.Refresh) {
        window.desktopApi.reload();
      }
    },
    [activeTabId, handleCloseWebTab, navigation],
  );

  useShortcuts(undefined, handleShortcuts);
};
