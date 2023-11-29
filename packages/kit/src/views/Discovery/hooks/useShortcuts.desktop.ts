import { useEffect, useRef } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import { EBrowserShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { EModalRoutes } from '../../../routes/Root/Modal/Routes';
import { ETabRoutes } from '../../../routes/Root/Tab/Routes';
import { useBrowserTabActions } from '../../../states/jotai/contexts/discovery';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../router/Routes';
import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId } from './useWebTabs';

import type { IElectronWebView } from '../components/WebView/types';

export const useShortcuts = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const isAtDiscoveryTab = useRef(false);
  const isAtBrowserTab = useRef(false);
  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    isAtDiscoveryTab.current = isFocus;
  });
  useListenTabFocusState(ETabRoutes.MultiTabBrowser, (isFocus) => {
    isAtBrowserTab.current = isFocus;
  });

  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions();

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
          if (activeTabId) {
            closeWebTab(activeTabId);
          }
          return;
        }
      }
      if (isAtBrowserTab.current || isAtDiscoveryTab.current) {
        if (data === EBrowserShortcutEvents.NewTab) {
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
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
  }, [activeTabId, closeWebTab, navigation]);
};
