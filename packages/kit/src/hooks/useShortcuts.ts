import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ExplorerShortcutEvents } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { TabRoutes } from '../routes/routesEnum';
import { appSelector } from '../store';
import { closeWebTab, setCurrentWebTab } from '../store/reducers/webTabs';
import { isAtAppRootTab } from '../utils/routeUtils';
import {
  addNewWebTab,
  getWebviewWrapperRef,
} from '../views/Discover/Explorer/explorerUtils';

export const useShortcuts = platformEnv.isDesktop
  ? () => {
      useEffect(() => {
        const handleShortcuts = (_e: any, data: ExplorerShortcutEvents) => {
          const isFocusedInDiscoverTab = isAtAppRootTab(TabRoutes.Discover);
          const { dispatch } = backgroundApiProxy;
          if (isFocusedInDiscoverTab) {
            if (data === ExplorerShortcutEvents.NewTab) {
              addNewWebTab({ isCurrent: false });
            } else if (data === ExplorerShortcutEvents.NewTabAndFocus) {
              addNewWebTab();
            } else if (data === ExplorerShortcutEvents.JumpToNextTab) {
              const tabs = appSelector((s) => s.webTabs.tabs);
              const curTabIndex = tabs.findIndex((tab) => tab.isCurrent);
              dispatch(
                setCurrentWebTab(tabs[(curTabIndex + 1) % tabs.length].id),
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
            } else if (data === ExplorerShortcutEvents.CloseTab) {
              const tabs = appSelector((s) => s.webTabs.tabs);
              if (tabs.length > 1) {
                dispatch(closeWebTab(tabs[tabs.length - 1].id));
              } else {
                window.desktopApi.quitApp();
              }
            }
          } else if (data === ExplorerShortcutEvents.CloseTab) {
            window.desktopApi.quitApp();
          }
        };
        window.desktopApi.addIpcEventListener('shortcut', handleShortcuts);
        return () =>
          window.desktopApi.removeIpcEventListener('shortcut', handleShortcuts);
      }, []);
    }
  : () => {};
