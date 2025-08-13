import { useCallback, useEffect, useRef } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

export const useShortcuts = (
  eventName: EShortcutEvents | undefined,
  callback: (event: EShortcutEvents) => void,
) => {
  useEffect(() => {
    if (platformEnv.isDesktop) {
      const handleCallback = (_: unknown, e: EShortcutEvents) => {
        if (eventName === undefined || e === eventName) {
          callback(e);
        }
      };
      globalThis.desktopApi.addIpcEventListener(
        ipcMessageKeys.APP_SHORCUT,
        handleCallback,
      );
      return () => {
        globalThis.desktopApi.removeIpcEventListener(
          ipcMessageKeys.APP_SHORCUT,
          handleCallback,
        );
      };
    }
  }, [callback, eventName]);
};

export function useShortcutsRouteStatus() {
  const shouldReloadAppByCmdR = useRef(true);
  const isAtBrowserTab = useRef(false);
  const isAtPerpTab = useRef(false);
  const isAtDiscoveryTab = useRef(false);

  const updateShouldReloadAppByCmdR = useCallback(() => {
    shouldReloadAppByCmdR.current =
      !isAtBrowserTab.current && !isAtPerpTab.current;
  }, []);

  useListenTabFocusState(
    ETabRoutes.MultiTabBrowser,
    (isFocus, isHideByModal) => {
      isAtBrowserTab.current = !isHideByModal && isFocus;
      updateShouldReloadAppByCmdR();
    },
  );

  useListenTabFocusState(ETabRoutes.PerpTrade, (isFocus, isHideByModal) => {
    isAtPerpTab.current = !isHideByModal && isFocus;
    updateShouldReloadAppByCmdR();
  });

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    isAtDiscoveryTab.current = isFocus;
    updateShouldReloadAppByCmdR();
  });

  return {
    isAtDiscoveryTab,
    isAtBrowserTab,
    isAtPerpTab,
    shouldReloadAppByCmdR,
  };
}
