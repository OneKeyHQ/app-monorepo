import { useEffect, useRef, useState } from 'react';

export function useIsFirstFocused() {
  const isFocusedRef = useRef(false);
  const [isFirstFocused, setIsFirstFocused] = useState(false);
  useEffect(() => {
    if (isFocusedRef.current) {
      return;
    }
    isFocusedRef.current = true;
    setIsFirstFocused(true);
  }, []);
  return isFirstFocused;
}
