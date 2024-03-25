import type { PropsWithChildren, ReactNode } from 'react';
import { memo } from 'react';

import { useIsFocused } from '@react-navigation/native';

const pageExtra: {
  children?: ReactNode;
} = { children: undefined };

export function Every({ children }: PropsWithChildren) {
  pageExtra.children = children;
  return null;
}

function BasicPageEvery() {
  const isFocused = useIsFocused();
  return isFocused ? pageExtra.children : null;
}

export const PageEvery = memo(BasicPageEvery);
