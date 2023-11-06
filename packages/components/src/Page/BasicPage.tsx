import type { PropsWithChildren } from 'react';

import { Stack } from '../Stack';

export function BasicPage({ children }: PropsWithChildren<unknown>) {
  return (
    <Stack bg="$bg" flex={1}>
      {children}
    </Stack>
  );
}
