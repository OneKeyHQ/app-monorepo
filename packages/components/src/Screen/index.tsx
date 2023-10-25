import type { PropsWithChildren } from 'react';

import { Stack } from '../Stack';

export function Screen({ children }: PropsWithChildren<unknown>) {
  return <Stack bg="$bg">{children}</Stack>;
}
