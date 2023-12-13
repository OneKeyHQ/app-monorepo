import { type PropsWithChildren, useContext, useMemo } from 'react';

import { Stack } from '../../primitives';

import { PageContext } from './PageContext';

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
