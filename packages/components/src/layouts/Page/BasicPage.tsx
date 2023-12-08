import { Stack } from '../../primitives';

import type { IBasicPageProps } from './type';

export function BasicPage({ children }: IBasicPageProps) {
  return (
    <Stack bg="$bgApp" flex={1}>
      {children}
    </Stack>
  );
}
