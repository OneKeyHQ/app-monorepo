import { type PropsWithChildren, useContext, useMemo } from 'react';

import { Stack } from '../../primitives';

import { PageContext } from './PageContext';

import type { StackStyleProps } from '@tamagui/web/types/types';

export function PageBody({
  children,
  ...props
}: PropsWithChildren<StackStyleProps>) {
  const { options = {} } = useContext(PageContext);
  const { avoidHeight } = options;
  console.log('avoidHeight', options);
  return useMemo(
    () => (
      <Stack flex={1} {...props} bottom={avoidHeight}>
        {children}
      </Stack>
    ),
    [avoidHeight, children, props],
  );
}
