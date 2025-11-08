import type { ReactNode } from 'react';

import { Stack } from '@onekeyhq/components';

interface IResponsiveTwoColumnLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  gap?: string;
  p?: string;
}

export function ResponsiveTwoColumnLayout({
  leftColumn,
  rightColumn,
  gap = '$5',
  p = '$5',
}: IResponsiveTwoColumnLayoutProps) {
  return (
    <Stack
      gap={gap}
      p={p}
      flexDirection="row"
      $md={{
        flexDirection: 'column',
      }}
    >
      <Stack
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        $md={{
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
        }}
      >
        {leftColumn}
      </Stack>

      <Stack
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        $md={{
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 'auto',
        }}
      >
        {rightColumn}
      </Stack>
    </Stack>
  );
}
