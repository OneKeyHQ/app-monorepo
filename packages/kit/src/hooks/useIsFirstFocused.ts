import { useEffect, useRef, useState } from 'react';

export function useIsFirstFocused(isFocused = false) {
  const isFocusedRef = useRef(false);
  const [isFirstFocused, setIsFirstFocused] = useState(false);
  useEffect(() => {
    if (isFocusedRef.current) {
      return;
    }
    if (isFocused) {
      isFocusedRef.current = true;
      setIsFirstFocused(true);
    }
  }, [isFocused]);
  return isFirstFocused;
}
