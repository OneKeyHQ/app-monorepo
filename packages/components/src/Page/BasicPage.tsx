import type { PropsWithChildren } from 'react';

import { Stack } from '../Stack';

export function BasicPage({
  children,
}: PropsWithChildren<unknown> & {
  skipLoading?: boolean;
}) {
  return (
    <Stack bg="$bgApp" flex={1}>
      {children}
    </Stack>
  );
}
