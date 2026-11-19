import type { FocusEvent, KeyboardEvent } from 'react';
import { useCallback, useState } from 'react';

export function useCopyButtonKeyboardFocus() {
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const updateFocusVisible = useCallback(
    (event: FocusEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      setIsKeyboardFocused(event.currentTarget.matches(':focus-visible'));
    },
    [],
  );
  const clearFocus = useCallback(() => setIsKeyboardFocused(false), []);

  return {
    isKeyboardFocused,
    focusProps: {
      onFocus: updateFocusVisible,
      onKeyDown: updateFocusVisible,
      onBlur: clearFocus,
      onPointerDown: clearFocus,
    },
  };
}
