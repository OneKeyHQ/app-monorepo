import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MODIFIER_HINT_HOLD_MS,
  isEditableFocused,
  isPrimaryModifierHeld,
  isPrimaryModifierKeyEvent,
  shouldCancelModifierHintReveal,
} from './modifierHintRevealUtils';

export { MODIFIER_HINT_HOLD_MS } from './modifierHintRevealUtils';

export type IModifierHintRevealHandlers = {
  hide: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  onBlur: () => void;
  onVisibilityChange: () => void;
};

export function createModifierHintRevealHandlers({
  enabled,
  onVisibleChange,
}: {
  enabled: boolean;
  onVisibleChange: (visible: boolean) => void;
}): IModifierHintRevealHandlers | undefined {
  if (
    !enabled ||
    !platformEnv.isDesktop ||
    typeof globalThis.addEventListener !== 'function'
  ) {
    onVisibleChange(false);
    return undefined;
  }

  const isAppleDesktop = !!platformEnv.isDesktopMac;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = () => {
    clearTimeout(timer);
    timer = undefined;
    onVisibleChange(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableFocused()) {
      hide();
      return;
    }

    if (shouldCancelModifierHintReveal(event, isAppleDesktop)) {
      hide();
      return;
    }

    if (isPrimaryModifierKeyEvent(event, isAppleDesktop) && !event.repeat) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        onVisibleChange(true);
      }, MODIFIER_HINT_HOLD_MS);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (
      isPrimaryModifierKeyEvent(event, isAppleDesktop) ||
      !isPrimaryModifierHeld(event, isAppleDesktop)
    ) {
      hide();
    }
  };

  const onBlur = () => {
    hide();
  };

  const onVisibilityChange = () => {
    if (globalThis.document.visibilityState !== 'visible') {
      hide();
    }
  };

  return {
    hide,
    onKeyDown,
    onKeyUp,
    onBlur,
    onVisibilityChange,
  };
}

export function attachModifierHintRevealListeners(
  handlers: IModifierHintRevealHandlers,
) {
  globalThis.addEventListener('keydown', handlers.onKeyDown, true);
  globalThis.addEventListener('keyup', handlers.onKeyUp, true);
  globalThis.addEventListener('blur', handlers.onBlur);
  globalThis.document.addEventListener(
    'visibilitychange',
    handlers.onVisibilityChange,
  );

  return () => {
    handlers.hide();
    globalThis.removeEventListener('keydown', handlers.onKeyDown, true);
    globalThis.removeEventListener('keyup', handlers.onKeyUp, true);
    globalThis.removeEventListener('blur', handlers.onBlur);
    globalThis.document.removeEventListener(
      'visibilitychange',
      handlers.onVisibilityChange,
    );
  };
}
