import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useV4MigrationActions } from '../hooks/useV4MigrationActions';

export function V4MigrationLogCopy({
  children,
  ...others
}: {
  children?: ReactNode;
} & ComponentProps<typeof Stack>) {
  const actions = useV4MigrationActions();
  const [clickCount, setClickCount] = useState(0);

  return (
    <Stack
      {...others}
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
      <Stack
        w="$8"
        h="$8"
        backgroundColor={platformEnv.isDev ? '$bgCriticalSubdued' : undefined}
      />
    </V4MigrationLogCopy>
  );
}
