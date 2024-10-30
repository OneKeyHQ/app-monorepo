import { app, globalShortcut } from 'electron';

import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

export function registerShortcuts(callback: (event: EShortcutEvents) => void) {
  void app.whenReady().then(() => {
    Object.entries(shortcutsMap).forEach(([event, { keys }]) => {
      if (keys?.length) {
        globalShortcut.register(
          keys
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
            .join('+'),
          () => {
            callback(event as EShortcutEvents);
          },
        );
      }
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
