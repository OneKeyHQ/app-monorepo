import { useCallback } from 'react';

import { useShortcuts } from '@onekeyhq/components';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useAppNavigation from './useAppNavigation';
import { useShortcutsRouteStatus } from './useListenTabFocusState';

export const useGlobalShortcuts = () => {
  const navigation = useAppNavigation();
  const { isAtBrowserTab, shouldReloadAppByCmdR } = useShortcutsRouteStatus();

  const handleShortcuts = useCallback(
    (data: EShortcutEvents) => {
      switch (data) {
        case EShortcutEvents.UniversalSearch:
          navigation.pushModal(EModalRoutes.UniversalSearchModal, {
            screen: EUniversalSearchPages.UniversalSearch,
          });
          break;
        case EShortcutEvents.Refresh:
          if (!isAtBrowserTab.current && shouldReloadAppByCmdR.current) {
            void globalThis.desktopApiProxy?.system?.reload?.();
          }
          break;
        case EShortcutEvents.CloseTab:
          if (!isAtBrowserTab.current) {
            void globalThis.desktopApiProxy?.system?.quitApp?.();
          }
          break;
        default:
          break;
      }
    },
    [isAtBrowserTab, navigation, shouldReloadAppByCmdR],
  );

  useShortcuts(undefined, handleShortcuts);
};
