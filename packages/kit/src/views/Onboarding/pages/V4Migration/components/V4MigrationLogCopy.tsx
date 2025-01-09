import type { ComponentProps, ReactNode } from 'react';

import { Stack } from '@onekeyhq/components';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useV4MigrationActions } from '../hooks/useV4MigrationActions';

export function V4MigrationLogCopy({
  children,
  ...others
}: {
  children?: ReactNode;
} & ComponentProps<typeof Stack>) {
  const actions = useV4MigrationActions();

  return (
    <MultipleClickStack
      {...others}
      onPress={() => {
        void actions.copyV4MigrationLogs();
      }}
    >
      {children}
    </MultipleClickStack>
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
