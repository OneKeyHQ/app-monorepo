import { useMemo } from 'react';

import { Stack } from '../../primitives';

import type { IStackProps } from '../../primitives';

export function PageBody({ children, ...props }: IStackProps) {
  return useMemo(
    () => (
      <Stack flex={1} {...props}>
        {children}
      </Stack>
    ),
    [children, props],
  );
}
