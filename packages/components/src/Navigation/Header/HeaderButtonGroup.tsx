import { Children } from 'react';
import type { ReactNode } from 'react';

import { Stack } from '../../Stack';

export default function HeaderButtonGroup({
  children,
}: {
  children: ReactNode;
}) {
  const childCount = Children.count(children);

  return (
    <Stack
      flexDirection="row"
      space={childCount > 1 ? '$4' : '0'}
      alignItems="center"
      testID="Navigation-HeaderView-ButtonGroup"
    >
      {children}
    </Stack>
  );
}
