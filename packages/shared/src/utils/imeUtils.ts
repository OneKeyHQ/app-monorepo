import { useEffect, useRef } from 'react';

/**
 * IME processing keyCode used by Chromium / Windows while composition is active.
 * Keyboard events during composition often report this instead of the physical key.
 */
export const IME_KEYCODE = 229;

export type IImeKeyboardEventLike = {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
  which?: number;
  nativeEvent?: {
    isComposing?: boolean;
    key?: string;
    keyCode?: number;
    which?: number;
  };
};

export type IImeCompositionLock = {
  isLocked: () => boolean;
  start: () => void;
  end: () => void;
  shouldIgnoreKeyboardEvent: (event: IImeKeyboardEventLike) => boolean;
  dispose: () => void;
};

export function isImeComposingKeyboardEvent(
  event: IImeKeyboardEventLike,
): boolean {
  const nativeEvent = event.nativeEvent;
  return (
    event.isComposing === true ||
    event.keyCode === IME_KEYCODE ||
    event.which === IME_KEYCODE ||
    nativeEvent?.isComposing === true ||
    nativeEvent?.keyCode === IME_KEYCODE ||
    nativeEvent?.which === IME_KEYCODE
  );
}

export function getKeyboardEventKey(event: IImeKeyboardEventLike): string {
  return event.key || event.nativeEvent?.key || '';
}

/**
 * Tracks IME composition and the confirming key event that some browsers
 * fire after `compositionend` with `isComposing` already false.
 */
export function createImeCompositionLock(): IImeCompositionLock {
  let locked = false;
  let unlockTimer: ReturnType<typeof setTimeout> | undefined;

  const clearUnlockTimer = () => {
    if (unlockTimer !== undefined) {
      clearTimeout(unlockTimer);
      unlockTimer = undefined;
    }
  };

  return {
    isLocked: () => locked,
    start() {
      clearUnlockTimer();
      locked = true;
    },
    end() {
      clearUnlockTimer();
      unlockTimer = setTimeout(() => {
        locked = false;
        unlockTimer = undefined;
      }, 0);
    },
    shouldIgnoreKeyboardEvent(event: IImeKeyboardEventLike) {
      return locked || isImeComposingKeyboardEvent(event);
    },
    dispose() {
      clearUnlockTimer();
      locked = false;
    },
  };
}

export function useImeCompositionLock(): IImeCompositionLock {
  const lockRef = useRef<IImeCompositionLock | undefined>(undefined);
  if (!lockRef.current) {
    lockRef.current = createImeCompositionLock();
  }
  useEffect(
    () => () => {
      lockRef.current?.dispose();
    },
    [],
  );
  return lockRef.current;
}
