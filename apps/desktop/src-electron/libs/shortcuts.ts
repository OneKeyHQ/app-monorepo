import { app, globalShortcut } from 'electron';

import { getShortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type { EBrowserShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

const shortcutsMap = getShortcutsMap();
export function registerShortcuts(
  callback: (event: EBrowserShortcutEvents) => void,
) {
  void app.whenReady().then(() => {
    Object.entries(shortcutsMap).forEach(([event, { keys }]) => {
      if (keys) {
        globalShortcut.register(keys, () => {
          console.log('shortcut', event);
          callback(event as EBrowserShortcutEvents);
        });
      }
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
