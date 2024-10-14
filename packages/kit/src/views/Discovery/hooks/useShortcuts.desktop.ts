import { useCallback, useEffect, useRef } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
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
import { EBrowserShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

export const useShortcuts = () => {
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

  useEffect(() => {
    const handleShortcuts = (_: any, data: EBrowserShortcutEvents) => {
      // only handle shortcuts when at browser tab
      if (isAtBrowserTab.current) {
        if (data === EBrowserShortcutEvents.GoForwardHistory) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.goForward();
          } catch {
            // empty
          }
        }
        if (data === EBrowserShortcutEvents.GoBackHistory) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.goBack();
          } catch {
            // empty
          }
        }
        if (data === EBrowserShortcutEvents.Refresh) {
          try {
            (
              webviewRefs[activeTabId ?? '']?.innerRef as IElectronWebView
            )?.reload();
          } catch {
            // empty
          }
          return;
        }
        if (data === EBrowserShortcutEvents.CloseTab) {
          handleCloseWebTab();
          return;
        }
      }
      if (isAtBrowserTab.current || isAtDiscoveryTab.current) {
        if (data === EBrowserShortcutEvents.NewTab) {
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.SearchModal,
          });
        }
      }

      if (isAtBrowserTab.current) {
        return;
      }

      if (data === EBrowserShortcutEvents.CloseTab) {
        window.desktopApi.quitApp();
      } else if (data === EBrowserShortcutEvents.Refresh) {
        window.desktopApi.reload();
      }
    };
    window.desktopApi.addIpcEventListener(
      ipcMessageKeys.APP_SHORCUT,
      handleShortcuts,
    );
    return () =>
      window.desktopApi.removeIpcEventListener(
        ipcMessageKeys.APP_SHORCUT,
        handleShortcuts,
      );
  }, [activeTabId, closeWebTab, navigation, handleCloseWebTab]);
};
