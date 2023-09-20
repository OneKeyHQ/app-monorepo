import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ExplorerShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { TabRoutes } from '../routes/routesEnum';
import { webTabsActions } from '../store/observable/webTabs';
import { isAtAppRootTab } from '../utils/routeUtils';
import { getWebTabs } from '../views/Discover/Explorer/Controller/useWebTabs';
import { getWebviewWrapperRef } from '../views/Discover/Explorer/explorerUtils';

export const useShortcuts = platformEnv.isDesktop
  ? () => {
      useEffect(() => {
        const handleShortcuts = (_e: any, data: ExplorerShortcutEvents) => {
          const isFocusedInDiscoverTab = isAtAppRootTab(TabRoutes.Discover);
          if (isFocusedInDiscoverTab) {
            if (data === ExplorerShortcutEvents.NewTab) {
              webTabsActions.addWebTab({ isCurrent: false });
            } else if (data === ExplorerShortcutEvents.NewTabAndFocus) {
              webTabsActions.addBlankWebTab();
            } else if (data === ExplorerShortcutEvents.JumpToNextTab) {
              const { tabs } = getWebTabs();
              const curTabIndex = tabs.findIndex((tab) => tab.isCurrent);
              webTabsActions.setCurrentWebTab(
                tabs[(curTabIndex + 1) % tabs.length].id,
              );
            } else if (data === ExplorerShortcutEvents.GobackHistory) {
              try {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                getWebviewWrapperRef()?.innerRef?.goBack();
                // eslint-disable-next-line no-empty
              } catch (e) {}
            } else if (data === ExplorerShortcutEvents.GoForwardHistory) {
              try {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                getWebviewWrapperRef()?.innerRef?.goForward();
                // eslint-disable-next-line no-empty
              } catch (e) {}
            } else if (
              data === ExplorerShortcutEvents.CloseTab ||
              data === ExplorerShortcutEvents.CloseTabOnWinOrLinux
            ) {
              const { tabs } = getWebTabs();
              if (tabs.length > 1) {
                webTabsActions.closeWebTab(tabs[tabs.length - 1].id);
              } else {
                window.desktopApi.quitApp();
              }
            }
          } else if (
            data === ExplorerShortcutEvents.CloseTab ||
            data === ExplorerShortcutEvents.CloseTabOnWinOrLinux
          ) {
            window.desktopApi.quitApp();
          }
        };
        window.desktopApi.addIpcEventListener('shortcut', handleShortcuts);
        return () =>
          window.desktopApi.removeIpcEventListener('shortcut', handleShortcuts);
      }, []);
    }
  : () => {};
