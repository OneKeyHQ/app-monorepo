import type { PropsWithChildren } from 'react';

import { Stack } from '../Stack';

import type { StackStyleProps } from '@tamagui/web/types/types';

export function PageBody({
  children,
  ...props
}: PropsWithChildren<StackStyleProps>) {
  return (
    <Stack flex={1} {...props}>
      {children}
    </Stack>
  );
}
