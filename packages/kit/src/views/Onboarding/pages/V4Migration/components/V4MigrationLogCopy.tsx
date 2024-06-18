import type { ReactNode } from 'react';

import { Stack } from '@onekeyhq/components';

import { useV4MigrationActions } from '../hooks/useV4MigrationActions';

export function V4MigrationLogCopy({ children }: { children?: ReactNode }) {
  const actions = useV4MigrationActions();
  return (
    <Stack
      onPress={() => {
        void actions.copyV4MigrationLogs();
      }}
    >
      {children}
    </Stack>
  );
}
export function V4MigrationLogCopyHeaderRight() {
  return (
    <V4MigrationLogCopy>
      <Stack w="$4" h="$4" />
    </V4MigrationLogCopy>
  );
}
