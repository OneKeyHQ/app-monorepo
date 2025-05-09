import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import { PageHeaderDivider } from './PageHeaderDivider';

import type { IStackProps } from '../../primitives';

export function PageBody({ children, ...props }: IStackProps) {
  return useMemo(
    () => (
      <Stack flex={1} {...props}>
        {platformEnv.isNativeIOSPad ? <PageHeaderDivider /> : null}
        {children}
      </Stack>
    ),
    [children, props],
  );
}
