import { useEffect } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
