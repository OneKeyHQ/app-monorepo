import { app, globalShortcut } from 'electron';

import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import * as store from './store';

export function registerShortcuts(
  callback: (eventName: EShortcutEvents) => void,
) {
  void app.whenReady().then(() => {
    const { disableAllShortcuts } = store.getDisableKeyboardShortcuts();
    if (disableAllShortcuts) {
      return;
    }
    Object.entries(shortcutsMap).forEach(([eventName, { keys }]) => {
      if (keys?.length) {
        const shortcutsKey = keys
          .map((key) => {
            switch (key) {
              case shortcutsKeys.CmdOrCtrl:
                return 'CmdOrCtrl';
              case shortcutsKeys.Shift:
                return 'Shift';
              default:
                return key;
            }
          })
          .join('+');
        globalShortcut.register(shortcutsKey, () => {
          callback(eventName as EShortcutEvents);
        });
      }
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
