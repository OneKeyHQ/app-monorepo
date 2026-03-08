import type { PropsWithChildren } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsFirstFocused } from '../../hooks/useIsFirstFocused';

export function LazyPageContainer({ children }: PropsWithChildren) {
  const isPageFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isPageFocused);
  return isFirstFocused ? children : null;
}
