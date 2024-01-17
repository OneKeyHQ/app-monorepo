import { useMemo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

export function DashboardContent() {
  const content = useMemo(() => 'Hello World', []);
  return (
    <Stack>
      <SizableText>{content}</SizableText>
    </Stack>
  );
}
