import { useEffect, useState } from 'react';

export const MODIFIER_HOLD_DELAY_MS = 500;

// True while the modifier alone has been held for a moment. Any other key,
// releasing it, or the window losing focus ends the hold, so quick combos
// such as Cmd+C never trigger it.
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
    return () => {
      clearTimeout(timer);
      globalThis.removeEventListener('keydown', onKeyDown, true);
      globalThis.removeEventListener('keyup', onKeyUp, true);
      globalThis.removeEventListener('blur', reset);
      setIsHeld(false);
    };
  }, [enabled, modifierKey]);
  return isHeld;
}
