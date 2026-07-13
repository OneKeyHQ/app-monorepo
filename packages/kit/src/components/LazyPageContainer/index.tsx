import type { PropsWithChildren } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsFirstFocused } from '../../hooks/useIsFirstFocused';

export function LazyPageContainer({
  children,
  eager,
}: PropsWithChildren<{ eager?: boolean }>) {
  const isPageFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isPageFocused);
  return eager || isFirstFocused ? children : null;
}
