import { useCallback, useEffect, useRef, useState } from 'react';

import { useShortcuts } from '@onekeyhq/components/src/hooks/useShortcuts';

export const MODIFIER_HOLD_DELAY_MS = 500;

// True while the modifier alone has been held for a moment. Any other key,
// releasing it, or the window losing focus ends the hold, so quick combos
// such as Cmd+C never trigger it. Registered app shortcuts (Cmd+2, ...) are
// taken by the Electron main process before the page sees the key, so they
// end the hold through the shortcut event instead.
export function useModifierKeyHold({
  enabled,
  modifierKey,
}: {
  enabled: boolean;
  modifierKey: 'Meta' | 'Control';
}) {
  const [isHeld, setIsHeld] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setIsHeld(false);
  }, []);

  useShortcuts(undefined, reset);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    // Other keys still down, so a key held before the modifier also counts.
    const otherKeysDown = new Set<string>();
    // macOS drops the keyup of keys pressed while Cmd is down; forget those
    // when the modifier goes up, but keep keys held from before it.
    const keysDownUnderModifier = new Set<string>();
    const resetAll = () => {
      otherKeysDown.clear();
      keysDownUnderModifier.clear();
      reset();
    };
    const isModifierDown = (event: KeyboardEvent) =>
      modifierKey === 'Meta' ? event.metaKey : event.ctrlKey;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== modifierKey) {
        // `code` is the physical key: `key` can change between down and up
        // (Shift+A released as "a").
        if (!otherKeysDown.has(event.code) && isModifierDown(event)) {
          keysDownUnderModifier.add(event.code);
        }
        otherKeysDown.add(event.code);
        reset();
        return;
      }
      if (event.repeat) {
        return;
      }
      reset();
      const otherModifier =
        modifierKey === 'Meta' ? event.ctrlKey : event.metaKey;
      if (
        event.shiftKey ||
        event.altKey ||
        otherModifier ||
        otherKeysDown.size > 0
      ) {
        return;
      }
      timerRef.current = setTimeout(
        () => setIsHeld(true),
        MODIFIER_HOLD_DELAY_MS,
      );
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === modifierKey) {
        keysDownUnderModifier.forEach((code) => otherKeysDown.delete(code));
        keysDownUnderModifier.clear();
        reset();
        return;
      }
      otherKeysDown.delete(event.code);
      keysDownUnderModifier.delete(event.code);
    };
    globalThis.addEventListener('keydown', onKeyDown, true);
    globalThis.addEventListener('keyup', onKeyUp, true);
    globalThis.addEventListener('blur', resetAll);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown, true);
      globalThis.removeEventListener('keyup', onKeyUp, true);
      globalThis.removeEventListener('blur', resetAll);
      reset();
    };
  }, [enabled, modifierKey, reset]);
  return isHeld;
}
