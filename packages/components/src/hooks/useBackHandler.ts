import { useCallback, useEffect } from 'react';

const stopDefaultBackHandler = () => true;

// One Escape press closes one layer. A dialog answers the press on keydown
// and claims it, so the keyup handlers (the modal under that dialog) leave
// it alone. Every press starts unclaimed, before any handler runs: the reset
// listens on the document, because the app's preload wraps the window's
// addEventListener without its capture flag, and a text input stops its
// keydown before it bubbles up to the window
let isEscapePressClaimed = false;
let isEscapePressTracked = false;
const trackEscapePresses = () => {
  if (isEscapePressTracked) {
    return;
  }
  isEscapePressTracked = true;
  globalThis.document?.addEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        isEscapePressClaimed = false;
      }
    },
    true,
  );
};

// A layer that closes on a press its own text field answers (the field stops
// the keydown before the window) claims the press with this
export const claimEscapePress = () => {
  isEscapePressClaimed = true;
};

export const useBackHandler = (
  callback: () => boolean = stopDefaultBackHandler,
  enable: boolean | undefined = true,
  // because of https://github.com/necolas/react-native-web/blob/54c14d64dabd175e8055e1dc92e9196c821f9b7d/packages/react-native-web/src/exports/TextInput/index.js#L304
  isKeyDown = true,
  // A layer that closes on the press (a dialog): once it has handled the
  // press, the layers under it don't get it as well
  claimsEscapePress = false,
) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (!isKeyDown && isEscapePressClaimed) {
        return;
      }
      const handled = callback?.();
      if (isKeyDown && claimsEscapePress && handled) {
        isEscapePressClaimed = true;
      }
    },
    [callback, claimsEscapePress, isKeyDown],
  );

  useEffect(() => {
    if (!enable) return;
    trackEscapePresses();
    globalThis.addEventListener(isKeyDown ? 'keydown' : 'keyup', handleKeyDown);
    return () => {
      globalThis.removeEventListener(
        isKeyDown ? 'keydown' : 'keyup',
        handleKeyDown,
      );
    };
  }, [enable, handleKeyDown, isKeyDown]);
};
