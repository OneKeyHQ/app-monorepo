import { app, globalShortcut } from 'electron';

import type { ExplorerShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { getShortcutsMap } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

const shortcutsMap = getShortcutsMap(process.platform === 'darwin');
export function registerShortcuts(
  callback: (event: ExplorerShortcutEvents) => void,
) {
  app.whenReady().then(() => {
    Object.entries(shortcutsMap).forEach(([event, { keys }]) => {
      if (keys) {
        globalShortcut.register(keys, () => {
          console.log('shortcut', event);
          callback(event as ExplorerShortcutEvents);
        });
      }
    });
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
