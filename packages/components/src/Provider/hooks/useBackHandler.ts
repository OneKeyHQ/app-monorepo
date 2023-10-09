import { useCallback, useEffect } from 'react';

const stopDefaultBackHandler = () => true;

const useBackHandler = (callback: () => boolean = stopDefaultBackHandler) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback?.();
      }
    },
    [callback],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [callback, handleKeyDown]);
};

export default useBackHandler;
