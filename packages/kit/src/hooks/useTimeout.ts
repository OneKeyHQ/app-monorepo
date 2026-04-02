import { useEffect } from 'react';

/**
 * A hook that executes a callback after a specified delay.
 * @param callback Function to execute after the delay
 * @param delay Time in milliseconds to wait before executing the callback
 */
export const useTimeout = (callback: () => void, delay: number) => {
  useEffect(() => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  }, [callback, delay]);
};
