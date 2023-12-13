import { type PropsWithChildren, useMemo } from 'react';

import { Stack } from '../../primitives';

import type { StackStyleProps } from '@tamagui/web/types/types';

export function PageBody({
  children,
  ...props
}: PropsWithChildren<StackStyleProps>) {
  return useMemo(
    () => (
      <Stack flex={1} {...props}>
        {children}
      </Stack>
    ),
    [children, props],
  );
}
