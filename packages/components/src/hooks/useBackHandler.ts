import { useCallback, useEffect } from 'react';

const stopDefaultBackHandler = () => true;

export const useBackHandler = (
  callback: () => boolean = stopDefaultBackHandler,
  enable: boolean | undefined = true,
  // because of https://github.com/necolas/react-native-web/blob/54c14d64dabd175e8055e1dc92e9196c821f9b7d/packages/react-native-web/src/exports/TextInput/index.js#L304
  isKeyDown = true,
) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback?.();
      }
    },
    [callback],
  );

  useEffect(() => {
    if (!enable) return;
    globalThis.addEventListener(isKeyDown ? 'keydown' : 'keyup', handleKeyDown);
    return () => {
      globalThis.removeEventListener(
        isKeyDown ? 'keydown' : 'keyup',
        handleKeyDown,
      );
    };
  }, [enable, handleKeyDown, isKeyDown]);
};
