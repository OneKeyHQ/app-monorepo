import { Stack } from '../../primitives';

import type { ISplashViewChildrenContentProps } from './type';

export function ChildrenContent({
  children,
  onLayout,
}: ISplashViewChildrenContentProps) {
  return (
    <Stack flex={1} onLayout={onLayout}>
      {children}
    </Stack>
  );
}
