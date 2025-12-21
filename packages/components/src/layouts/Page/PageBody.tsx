import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMedia } from '../../hooks';
import { Stack } from '../../primitives';

import { PageHeaderDivider } from './PageHeaderDivider';

import type { IStackProps } from '../../primitives';

const useDesktopLayout = platformEnv.isNative
  ? () => false
  : () => {
      const { gtMd } = useMedia();
      return gtMd;
    };

export function PageBody({ children, ...props }: IStackProps) {
  const isDesktopLayout = useDesktopLayout();
  return useMemo(
    () => (
      <Stack
        flex={1}
        {...props}
        borderRadius={isDesktopLayout ? '$4' : undefined}
        borderWidth={isDesktopLayout ? 1 : undefined}
        borderColor={isDesktopLayout ? '$borderSubdued' : undefined}
        mr={isDesktopLayout ? '$1' : undefined}
        mb={isDesktopLayout ? '$1' : undefined}
      >
        {platformEnv.isNativeIOSPad ? <PageHeaderDivider /> : null}
        {children}
      </Stack>
    ),
    [children, props, isDesktopLayout],
  );
}
