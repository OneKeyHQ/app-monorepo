import { useEffect } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/src-electron/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

export const useShortcuts = (
  eventName: EShortcutEvents | undefined,
  callback: (event: EShortcutEvents) => void,
) => {
  useEffect(() => {
    const handleCallback = (_: unknown, e: EShortcutEvents) => {
      if (eventName === undefined || e === eventName) {
        callback(e);
      }
    };
    if (platformEnv.isDesktop) {
      window.desktopApi.addIpcEventListener(
        ipcMessageKeys.APP_SHORCUT,
        handleCallback,
      );
      return () => {
        window.desktopApi.removeIpcEventListener(
          ipcMessageKeys.APP_SHORCUT,
          handleCallback,
        );
      };
    }
  }, [callback, eventName]);
};
