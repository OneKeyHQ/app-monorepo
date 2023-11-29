import { useCallback, useEffect } from 'react';

const stopDefaultBackHandler = () => true;

export const useBackHandler = (
  callback: () => boolean = stopDefaultBackHandler,
  enable: boolean | undefined = true,
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
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enable, handleKeyDown]);
};
