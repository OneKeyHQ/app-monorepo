import { useLayoutEffect, useState } from 'react';

export const useVisible = (delayMs: number) => {
  const [visible, setVisible] = useState(!(delayMs > 0));
  useLayoutEffect(() => {
    if (delayMs > 0) {
      const timerId = setTimeout(() => {
        setVisible(true);
      }, delayMs);
      return () => {
        clearTimeout(timerId);
      };
    }
  }, [delayMs]);
  return visible;
};
