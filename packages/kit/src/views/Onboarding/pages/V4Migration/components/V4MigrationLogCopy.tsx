import { type ReactNode, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { useV4MigrationActions } from '../hooks/useV4MigrationActions';

export function V4MigrationLogCopy({ children }: { children?: ReactNode }) {
  const actions = useV4MigrationActions();
  const [clickCount, setClickCount] = useState(0);
  return (
    <Stack
      onPress={() => {
        if (clickCount > 10) {
          void actions.copyV4MigrationLogs();
        }
        setClickCount((prev) => prev + 1);
      }}
    >
      {children}
    </Stack>
  );
}
export function V4MigrationLogCopyHeaderRight() {
  return (
    <V4MigrationLogCopy>
      <Stack w="$8" h="$8" />
    </V4MigrationLogCopy>
  );
}
