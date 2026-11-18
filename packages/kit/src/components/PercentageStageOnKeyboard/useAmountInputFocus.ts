import { useCallback, useRef, useState } from 'react';

export function useAmountInputFocus() {
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const focusedInputIdRef = useRef<string | undefined>(undefined);

  const onAmountFocusChange = useCallback(
    (inputId: string, focused: boolean) => {
      if (focused) {
        focusedInputIdRef.current = inputId;
        setIsAmountFocused(true);
      } else if (focusedInputIdRef.current === inputId) {
        focusedInputIdRef.current = undefined;
        setIsAmountFocused(false);
      }
    },
    [],
  );

  return { isAmountFocused, onAmountFocusChange };
}
