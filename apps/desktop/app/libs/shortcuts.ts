import { app, globalShortcut } from 'electron';
import logger from 'electron-log/main';

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

    const failedShortcuts: Array<{
      event: string;
      key: string;
      description: string;
    }> = [];
    let successCount = 0;

    Object.entries(shortcutsMap).forEach(([eventName, { keys, desc }]) => {
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

        const success = globalShortcut.register(shortcutsKey, () => {
          callback(eventName as EShortcutEvents);
        });

        if (success) {
          successCount += 1;
        } else {
          const conflictInfo = {
            event: eventName,
            key: shortcutsKey,
            description: desc,
          };
          failedShortcuts.push(conflictInfo);
          logger.warn(
            `[Shortcuts] Failed to register shortcut: ${shortcutsKey} (${desc}) - Event: ${eventName}. This shortcut may be occupied by another application or system.`,
          );
        }
      }
    });

    // Log summary
    const totalShortcuts = Object.keys(shortcutsMap).filter(
      (key) => shortcutsMap[key as EShortcutEvents].keys?.length,
    ).length;
    logger.info(
      `[Shortcuts] Registration complete: ${successCount}/${totalShortcuts} shortcuts registered successfully.`,
    );

    if (failedShortcuts.length > 0) {
      logger.warn(
        `[Shortcuts] ${failedShortcuts.length} shortcut(s) failed to register:`,
        failedShortcuts.map((s) => `${s.key} (${s.description})`).join(', '),
      );
    }
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
