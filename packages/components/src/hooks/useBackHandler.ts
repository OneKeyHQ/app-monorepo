import { useEffect, useRef } from 'react';

import { overlayStore } from '@onekeyfe/react-native-native-overlay';

const stopDefaultBackHandler = () => true;

export const useBackHandler = (
  callback: () => boolean = stopDefaultBackHandler,
  enable: boolean | undefined = true,
  // because of https://github.com/necolas/react-native-web/blob/54c14d64dabd175e8055e1dc92e9196c821f9b7d/packages/react-native-web/src/exports/TextInput/index.js#L304
  isKeyDown = true,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enable) return;
    let skipEscapeKeyUp = false;
    const resetEscapePair = () => {
      skipEscapeKeyUp = false;
    };
    const observeKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Observe before the SDK's document listener dismisses or blocks the entry.
      skipEscapeKeyUp =
        skipEscapeKeyUp ||
        event.isComposing ||
        event.keyCode === 229 ||
        overlayStore.resolveBack().kind !== 'pass';
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const skip = !isKeyDown && skipEscapeKeyUp;
      resetEscapePair();
      if (event.isComposing || event.keyCode === 229 || skip) return;
      if (!isKeyDown && overlayStore.resolveBack().kind !== 'pass') return;
      callbackRef.current?.();
    };
    if (!isKeyDown) {
      globalThis.addEventListener('keydown', observeKeyDown, true);
      globalThis.addEventListener('blur', resetEscapePair);
    }
    globalThis.addEventListener(isKeyDown ? 'keydown' : 'keyup', handleKey);
    return () => {
      resetEscapePair();
      globalThis.removeEventListener('keydown', observeKeyDown, true);
      globalThis.removeEventListener('blur', resetEscapePair);
      globalThis.removeEventListener(
        isKeyDown ? 'keydown' : 'keyup',
        handleKey,
      );
    };
  }, [enable, isKeyDown]);
};
