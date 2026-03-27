import { useEffect } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

export const useShortcuts = (
  eventName: EShortcutEvents | undefined,
  callback: (event: EShortcutEvents) => void,
) => {
  useEffect(() => {
    if (platformEnv.isDesktop) {
      const handleCallback = (e: EShortcutEvents) => {
        if (eventName === undefined || e === eventName) {
          callback(e);
        }
      };
      const unsubscribe = globalThis.desktopApi.addIpcEventListener(
        ipcMessageKeys.APP_SHORTCUT,
        handleCallback,
      );
      return unsubscribe;
    }
  }, [callback, eventName]);
};
