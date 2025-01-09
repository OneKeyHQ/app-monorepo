import { app, globalShortcut } from 'electron';

import {
  EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import * as store from './store';

export function registerShortcuts(
  callback: (eventName: EShortcutEvents) => void,
) {
  void app.whenReady().then(() => {
    const { disableNumberShortcuts, disableSearchAndAccountSelectorShortcuts } =
      store.getDisableKeyboardShortcuts();
    Object.entries(shortcutsMap).forEach(([eventName, { keys }]) => {
      if (disableNumberShortcuts && keys?.includes(shortcutsKeys.CmdOrCtrl)) {
        return;
      }
      if (
        disableSearchAndAccountSelectorShortcuts &&
        [
          EShortcutEvents.SearchInPage,
          EShortcutEvents.AccountSelector,
        ].includes(eventName as EShortcutEvents)
      ) {
        return;
      }

      if (
        disableNumberShortcuts &&
        [
          EShortcutEvents.TabWallet,
          EShortcutEvents.TabEarn,
          EShortcutEvents.TabSwap,
          EShortcutEvents.TabMarket,
          EShortcutEvents.TabBrowser,
          EShortcutEvents.TabPin6,
          EShortcutEvents.TabPin7,
          EShortcutEvents.TabPin8,
          EShortcutEvents.TabPin9,
        ].includes(eventName as EShortcutEvents)
      ) {
        return;
      }
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
