import { useEffect, useState } from 'react';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';

export const MODIFIER_HOLD_DELAY_MS = 500;

// True while the modifier alone has been held for a moment. Any other key,
// releasing it, or the window losing focus ends the hold, so quick combos
// such as Cmd+C never trigger it. Registered app shortcuts (Cmd+2, ...) are
// taken by the Electron main process before the page sees the key, so they
// end the hold through the shortcut IPC instead.
export function useModifierKeyHold({
  enabled,
  modifierKey,
}: {
  enabled: boolean;
  modifierKey: 'Meta' | 'Control';
}) {
  const [isHeld, setIsHeld] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      clearTimeout(timer);
      timer = undefined;
      setIsHeld(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== modifierKey) {
        reset();
        return;
      }
      if (event.repeat) {
        return;
      }
      reset();
      const otherModifier =
        modifierKey === 'Meta' ? event.ctrlKey : event.metaKey;
      if (event.shiftKey || event.altKey || otherModifier) {
        return;
      }
      timer = setTimeout(() => setIsHeld(true), MODIFIER_HOLD_DELAY_MS);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === modifierKey) {
        reset();
      }
    };
    globalThis.addEventListener('keydown', onKeyDown, true);
    globalThis.addEventListener('keyup', onKeyUp, true);
    globalThis.addEventListener('blur', reset);
    const unsubscribeShortcut = globalThis.desktopApi?.addIpcEventListener(
      ipcMessageKeys.APP_SHORTCUT,
      reset,
    );
    return () => {
      clearTimeout(timer);
      unsubscribeShortcut?.();
      globalThis.removeEventListener('keydown', onKeyDown, true);
      globalThis.removeEventListener('keyup', onKeyUp, true);
      globalThis.removeEventListener('blur', reset);
      setIsHeld(false);
    };
  }, [enabled, modifierKey]);
  return isHeld;
}
